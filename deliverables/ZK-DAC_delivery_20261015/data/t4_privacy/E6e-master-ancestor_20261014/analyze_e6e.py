# E6e analysis (PREREGISTRATION.md). M1: E6d pair pipeline on world M (tasks C1/C2/C3, feature sets F1 = E6d A1, F2 = F1 + per-bit agreement), B = 5000.
# M2 / M3: candidate-conditioned scores of (transcript, hypothesis) rows; D3: dictionary test. usage (E6b venv):
#   python analyze_e6e.py d3 | m1 [B] [workers] | m2 [B] | m3 [B]        (E6E_DATA overrides the data directory)
import json, sys, os, random, importlib.util, warnings, hashlib
warnings.filterwarnings("ignore", category=RuntimeWarning)
import numpy as np
from sklearn.metrics import roc_auc_score

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("e6d", os.path.join(HERE, "../E6d-worlds-weakleak_20261013/analyze_e6d.py")); E = importlib.util.module_from_spec(spec); spec.loader.exec_module(E)
P = E.P; MODELS = E.MODELS; seed32 = E.seed32; holm = E.holm; cluster_ci = E.cluster_ci
DATA = os.environ.get("E6E_DATA", os.path.join(HERE, "results"))
D = 3; EW = [8 + 10 + j for j in range(D + 1)]; ESIGN = 8 + 14; NOW = 9           # word positions: e[0..3] = pub[10..13], e_sign = pub[14], now = pub[1]
MASK64 = (1 << 64) - 1

def load():
    rows = [json.loads(l) for l in open(os.path.join(DATA, "world_M.jsonl")) if l.strip()]
    kn = json.load(open(os.path.join(DATA, "knowledge.json"))); return rows, kn

# ======================= M1 =======================
M1_TASKS = ("C1", "C2", "C3"); M1_EPS = (0.0, 0.20, 0.30, 0.40); CHANNELS = ("W1", "W2", "W3"); FEATS = ("F1", "F2")
def unit_arr(rows, task): return np.array([t["agent"] if task == "C1" else t["parent"] if task == "C2" else t["master"] for t in rows])
def inject(rows, W, task, channel, eps):
    if channel is None: return [list(x) for x in W]
    u = unit_arr(rows, task); r = random.Random(f"e6e-leak-{task}"); bit = {x: r.random() < 0.5 for x in sorted(set(u))}
    rf = random.Random(f"e6e-leakflip-{task}-{channel}-{eps}"); out = []
    for k, x in enumerate(W):
        b = int(bit[u[k]] ^ (rf.random() < eps)); x = list(x)
        if channel == "W1": x.append((rf.getrandbits(63) << 1) | b)
        elif channel == "W2": x[NOW] = x[NOW] + 30 * b
        elif channel == "W3": x.append(b)
        out.append(x)
    return out
def featurize(F, I, J, feat):
    X = E.featurize_a1(F, I, J).astype(np.float32)
    return X if feat == "F1" else np.concatenate([X, E.bit_agreement(F, I, J)], axis=1)

def side_pool(rows, task, units_side, side):
    """512 transcripts of one side, chosen without looking at the permuted label (PREREGISTRATION.md M1 'Pools')"""
    r = random.Random(f"e6e-pool-{task}-{side}"); agent = [t["agent"] for t in rows]
    if task == "C1":
        ag = sorted(units_side); r.shuffle(ag); keep = set(ag[:64]); return np.array([i for i in range(len(rows)) if agent[i] in keep])
    u = unit_arr(rows, task); by = {}
    for i in range(len(rows)):
        if u[i] in units_side: by.setdefault(agent[i], []).append(i)
    out = []
    for a in sorted(by): out += r.sample(by[a], 2)
    return np.array(sorted(out))

def m1_test(args):
    task, feat, label, ch, eps, B = args
    rows, _ = load(); W = inject(rows, [E.base_words(t) for t in rows], task, ch, eps); F = E.precompute(W, D)
    u = unit_arr(rows, task); agent = np.array([t["agent"] for t in rows]); parent = np.array([t["parent"] for t in rows]); rnd = np.array([t["round"] for t in rows])
    units = sorted(set(u)); random.Random(f"e6e-split-{task}").shuffle(units); tr_u, te_u = set(units[:len(units) // 2]), set(units[len(units) // 2:])
    tr, te = side_pool(rows, task, tr_u, "train"), side_pool(rows, task, te_u, "test")
    sep = agent if task == "C2" else parent                                   # C2: different agents; C3: different parents; C1 uses rounds
    tk = "C1" if task == "C1" else "C2"                                       # E6d sample_pairs: 'C1' = different rounds, else different 'agent_arr'
    I, J, ytr = E.sample_pairs(u[tr], sep[tr], rnd[tr], tk, np.random.default_rng(seed32(f"e6e-pairs-{task}-train")))
    Xtr = featurize(F, tr[I], tr[J], feat)
    n = len(te); ii, jj = np.triu_indices(n, 1); ua, sa, ra = u[te], sep[te], rnd[te]
    elig = (ra[ii] != ra[jj]) if task == "C1" else (sa[ii] != sa[jj]); ii, jj = ii[elig], jj[elig]
    PI = np.full((n, n), -1, dtype=np.int64); PI[ii, jj] = np.arange(len(ii)); PI[jj, ii] = np.arange(len(ii))
    scores = {}
    for name in MODELS:
        m = MODELS[name](0)
        if name == "rf": m.set_params(n_jobs=1)
        m.fit(Xtr, ytr); s = np.empty(len(ii))
        for c in range(0, len(ii), 20000): s[c:c + 20000] = m.predict_proba(featurize(F, te[ii[c:c + 20000]], te[jj[c:c + 20000]], feat))[:, 1]
        scores[name] = s
    def draw(units_local, rng):
        a, b, y = E.sample_pairs(units_local, sa, ra, tk, rng); return PI[a, b], y, a, b
    k0, y0, a0, b0 = draw(ua, np.random.default_rng(seed32(f"e6e-pairs-{task}-test")))
    prng = random.Random(f"e6e-perm-{task}-{feat}-{label}"); null = {nm: [] for nm in MODELS}
    te_agents = agent[te]; te_par = parent[te]
    for _ in range(B):
        if task == "C1":       # within every round, permute the agent labels of that round's transcripts (each pool agent acts once per round)
            umap = ua.copy()
            for rr in np.unique(ra):
                idx = np.flatnonzero(ra == rr); lab = list(ua[idx]); prng.shuffle(lab); umap[idx] = lab
        elif task == "C2":     # permute the agent -> parent assignment (4 agents per parent kept)
            ags = sorted(set(te_agents)); par = [te_par[np.flatnonzero(te_agents == a)[0]] for a in ags]; prng.shuffle(par); pm = dict(zip(ags, par))
            umap = np.array([pm[a] for a in te_agents])
        else:                  # C3: permute the parent -> master assignment (4 parents per master kept)
            ps = sorted(set(te_par)); ms = [ua[np.flatnonzero(te_par == p)[0]] for p in ps]; prng.shuffle(ms); mm = dict(zip(ps, ms))
            umap = np.array([mm[p] for p in te_par])
        k, y, _, _ = draw(umap, np.random.default_rng(prng.getrandbits(32)))
        for nm in MODELS: null[nm].append(roc_auc_score(y, scores[nm][k]))
    out = {}
    for nm in MODELS:
        auc = roc_auc_score(y0, scores[nm][k0]); nl = np.array(null[nm])
        out[nm] = {"auc": float(auc), "p": (1 + int((nl >= auc).sum())) / (1 + B), "null_mean": float(nl.mean()), "null_q99": float(np.quantile(nl, 0.99)),
                   "ci95_cluster": cluster_ci(y0, scores[nm][k0], ua[a0], ua[b0], 0), "pool_pairs": int(len(ii)), "n_features": int(Xtr.shape[1])}
    print(f"m1 {task} {feat} {label} done", file=sys.stderr, flush=True)
    return (task, feat, label), out

def m1(B, workers):
    from multiprocessing import Pool
    variants = [("fresh", None, 0.0)] + [(f"{c}_eps{e}", c, e) for c in CHANNELS for e in M1_EPS]
    jobs = [(t, f, lab, c, e, B) for lab, c, e in variants for t in M1_TASKS for f in FEATS]
    with Pool(workers) as pool: res = dict(pool.map(m1_test, jobs, chunksize=1))
    cells = [(t, f, m) for t in M1_TASKS for f in FEATS for m in MODELS]; comb = {}
    for lab, _, _ in variants:
        ps = [res[(t, f, lab)][m]["p"] for t, f, m in cells]; adj = holm(ps)
        comb[lab] = {f"{t}/{f}/{m}": {**res[(t, f, lab)][m], "holm_p": a, "detected": bool(a < 0.01)} for (t, f, m), a in zip(cells, adj)}
    mde = {}
    for c in CHANNELS:
        for t in M1_TASKS:
            det = [e for e in M1_EPS if any(comb[f"{c}_eps{e}"][f"{t}/{f}/{m}"]["detected"] for f in FEATS for m in MODELS)]
            mde[f"{c}/{t}"] = {"largest_eps_detected": max(det) if det else None, "void": 0.0 not in det}
    return {"B": B, "link_decision": {k: v["detected"] for k, v in comb["fresh"].items()}, "combined": comb, "mde": mde}

# ======================= M2 / M3 =======================
def bits64(v):                                   # v: uint64 array (n, k) -> (n, 64k) float32, bit b of column c at c*64 + b
    return np.unpackbits(np.ascontiguousarray(v).astype("<u8").view(np.uint8).reshape(len(v), -1), axis=1, bitorder="little").astype(np.float32)
def chain_y(kn, agent): return [int(x) for x in kn[agent]["Ay"]]
def packed_par(kn, agent): return sum((int(x) & 1) << j for j, x in enumerate(kn[agent]["Ax"]))

def phi(e, es, ys, par, known):
    """candidate features for rows: e (n, 4) ints, es (n,) ints, ys (n, 4) ints (hypothesis plaintexts; unknown positions ignored), par (n,) packed parities or None"""
    n = len(e); cols = []; ms = {}
    for j in known:
        x = np.array([(e[i][j] ^ ys[i][j]) & MASK64 for i in range(n)], dtype=np.uint64)
        mj = [(e[i][j] - ys[i][j]) % P for i in range(n)]; ms[j] = mj
        d = np.array([v & MASK64 for v in mj], dtype=np.uint64)
        cols += [bits64(x[:, None]), bits64(d[:, None]), np.bitwise_count(x)[:, None].astype(np.float32), np.bitwise_count(d)[:, None].astype(np.float32)]
    for a in known:
        for b in known:
            if a < b: cols.append(bits64(np.array([(ms[a][i] ^ ms[b][i]) & MASK64 for i in range(n)], dtype=np.uint64)[:, None]))
    if par is not None:
        cols.append(np.array([[(es[i] ^ par[i]) >> b & 1 for b in range(D + 1)] for i in range(n)], dtype=np.float32))
        cols.append(bits64(np.array([((es[i] - par[i]) % P) & MASK64 for i in range(n)], dtype=np.uint64)[:, None]))
    return np.concatenate(cols, axis=1)

def ctx_feats(rows, idx):
    return np.array([[int(rows[i]["method"] == "0xa9059cbb"), int(rows[i]["target"].endswith("Ba5e")), int(rows[i]["amount"]), int(rows[i]["params"], 16),
                      rows[i]["now"], rows[i]["k"]] for i in idx], dtype=np.float32)

M2_TASKS = ("M2a-M", "M2a-P", "M2b-P", "M2b-M")
POS = {"M2a-M": 1, "M2a-P": 2, "M2b-P": 3, "M2b-M": 3}
def inject_k(rows, kn, task, ctl, lam):
    """returns e (n, 4) and e_sign lists after the control. K1: bit 0 of e_j* := bit 0 of y_j* (true chain) w.p. lam; K2: e_3 := y_3 + (e_0 - y_0) w.p. lam"""
    e = [[int(t["pub"][10 + j]) for j in range(D + 1)] for t in rows]; es = [int(t["pub"][14]) for t in rows]
    if ctl is None: return e, es
    r = random.Random(f"e6e-k-{task}-{ctl}-{lam}"); j = POS[task]
    for i, t in enumerate(rows):
        if r.random() >= lam: continue
        y = chain_y(kn, t["agent"])
        if ctl == "K1": e[i][j] = ((e[i][j] & ~1) | (y[j] & 1)) % P
        else: e[i][3] = (y[3] + e[i][0] - y[0]) % P
    return e, es

def m2_rows(rows, kn, task, side_units):
    """(transcript index, hypothesis agent-or-unit, label, group) for the transcripts / hypotheses of one side"""
    if task in ("M2a-M", "M2a-P"):
        lvl = "master" if task == "M2a-M" else "parent"; hyps = sorted(side_units)
        rep = {}
        for a, k in kn.items(): rep.setdefault(k[lvl], a)                     # any agent below the hypothesis unit: positions <= its level are shared
        T = [i for i, t in enumerate(rows) if t[lvl] in side_units]
        return [(i, rep[h], int(rows[i][lvl] == h), h) for h in hyps for i in T]
    lvl = "parent" if task == "M2b-P" else "master"
    kids = {}
    for a, k in kn.items(): kids.setdefault(k[lvl], []).append(a)
    return [(i, c, int(rows[i]["agent"] == c), rows[i][lvl]) for i, t in enumerate(rows) if t[lvl] in side_units for c in sorted(kids[t[lvl]])]

def rank_auc(ranks, y):
    n1 = y.sum(); n0 = len(y) - n1; return float((ranks[y == 1].sum() - n1 * (n1 + 1) / 2) / (n1 * n0))

def m2_test(rows, kn, task, ctl, lam, B, verifier=False):
    lvl = "master" if task.endswith("-M") else "parent"; units = sorted({t[lvl] for t in rows})
    random.Random(f"e6e-split-{task}").shuffle(units); tr_u, te_u = set(units[:len(units) // 2]), set(units[len(units) // 2:])
    e, es = inject_k(rows, kn, task, ctl, lam)
    known = [0, 1] if task == "M2a-M" else [0, 1, 2] if task == "M2a-P" else [0, 1, 2, 3]; full = task.startswith("M2b")
    def build(R):
        idx = [r[0] for r in R]; hyp = [r[1] for r in R]
        X = phi([e[i] for i in idx], [es[i] for i in idx], [chain_y(kn, h) for h in hyp], [packed_par(kn, h) for h in hyp] if full else None, known)
        if verifier: X = np.concatenate([X, ctx_feats(rows, idx)], axis=1)
        return X, np.array([r[2] for r in R])
    Rtr = m2_rows(rows, kn, task, tr_u); rs = random.Random(f"e6e-train-{task}")
    pos = [r for r in Rtr if r[2] == 1]; neg = [r for r in Rtr if r[2] == 0]
    Rtr = (rs.sample(pos, min(20000, len(pos))) + rs.sample(neg, min(20000, len(neg))))
    Xtr, ytr = build(Rtr); Rte = m2_rows(rows, kn, task, te_u); Xte, yte = build(Rte)
    ti = np.array([r[0] for r in Rte]); hy = np.array([r[1] for r in Rte]); grp = np.array([r[3] for r in Rte])
    out = {}
    agent_of = np.array([rows[i]["agent"] for i in ti]); unit_of = np.array([rows[i][lvl] for i in ti])
    hyp_unit = np.array([kn[h][lvl] for h in hy]) if task.startswith("M2a") else None
    from scipy.stats import rankdata
    if task.startswith("M2a"):
        u_names = sorted(set(unit_of)); ui = {x: k for k, x in enumerate(u_names)}; u_code = np.array([ui[x] for x in unit_of]); h_code = np.array([ui[x] for x in hyp_unit])
    else:
        a_names = sorted(set(agent_of) | set(hy)); ai = {x: k for k, x in enumerate(a_names)}; a_code = np.array([ai[x] for x in agent_of]); c_code = np.array([ai[x] for x in hy])
        g_members = [np.array(sorted({ai[a] for a in agent_of[grp == g]})) for g in sorted(set(grp))]
    for nm in MODELS:
        m = MODELS[nm](0)
        if nm == "rf": m.set_params(n_jobs=-1)
        m.fit(Xtr, ytr); s = m.predict_proba(Xte)[:, 1]
        rk = rankdata(s); auc = rank_auc(rk, yte); prng = np.random.default_rng(seed32(f"e6e-perm-{task}-{ctl}-{lam}-{verifier}")); null = []
        for _ in range(B):
            if task.startswith("M2a"):    # permute the unit labels of the test transcripts (whole subtrees move)
                perm = prng.permutation(len(u_names)); y = (perm[u_code] == h_code).astype(int)
            else:                          # inside every subtree, permute its agents
                perm = np.arange(len(a_names))
                for g in g_members: perm[g] = prng.permutation(g)
                y = (perm[a_code] == c_code).astype(int)
            null.append(rank_auc(rk, y))
        nl = np.array(null); r = {"auc": auc, "p": (1 + int((nl >= auc).sum())) / (1 + B), "null_mean": float(nl.mean()), "null_q99": float(np.quantile(nl, 0.99)),
                                  "n_test_rows": int(len(yte)), "n_train_rows": int(len(ytr)), "n_features": int(Xtr.shape[1])}
        if task.startswith("M2b"):
            top = {}
            for k_, (t_, c_) in enumerate(zip(ti, hy)):
                if t_ not in top or s[k_] > top[t_][0]: top[t_] = (s[k_], c_)
            r["top1"] = float(np.mean([rows[t_]["agent"] == c_ for t_, (_, c_) in top.items()])); r["top1_chance"] = 1 / (4 if task == "M2b-P" else 16)
        out[nm] = r
    print(f"{'m3' if verifier else 'm2'} {task} {ctl} {lam} done", file=sys.stderr, flush=True)
    return out

def family(res, keys):
    cells = [(k, m) for k in keys for m in MODELS]; adj = holm([res[k][m]["p"] for k, m in cells])
    return {f"{k}/{m}": {**res[k][m], "holm_p": a, "detected": bool(a < 0.01)} for (k, m), a in zip(cells, adj)}

def m2(B, verifier=False):
    rows, kn = load(); tasks = ("M2a-P", "M2b-P") if verifier else M2_TASKS
    variants = [("fresh", None, 0.0), ("K1_lam1", "K1", 1.0)] if verifier else \
               [("fresh", None, 0.0)] + [(f"K1_lam{l}", "K1", l) for l in (1.0, 0.5, 0.2, 0.1)] + [("K2_lam0.1", "K2", 0.1)]
    out = {"B": B, "variants": {}}
    for lab, ctl, lam in variants:
        ts = [t for t in tasks if not (ctl == "K2" and t.startswith("M2a"))]
        res = {t: m2_test(rows, kn, t, ctl, lam, B, verifier) for t in ts}; out["variants"][lab] = family(res, ts)
    out["link_decision"] = {k: v["detected"] for k, v in out["variants"]["fresh"].items()}
    out["void"] = {t: not any(out["variants"]["K1_lam1" if "K1_lam1" in out["variants"] else "K1_lam1.0"][f"{t}/{m}"]["detected"] for m in MODELS) for t in tasks}
    return out

# ======================= D3 =======================
def d3():
    rows, kn = load(); S = set()
    for k in kn.values():
        for v in k["Ax"] + k["Ay"] + k["cert"] + k["keyHash"] + [k["note0"]["cm"], k["note0"]["rho"]]: S.add(int(v))
        for v in k["cert"]: S.add(int(v) & ((1 << 252) - 1))
    S |= {(P - v) % P for v in list(S)}
    words = [[int(x, 0) for x in t["proof"]] + [int(x) for x in t["pub"]] + [int(x) for x in t["roots"]] for t in rows]
    ys = [sorted({int(k["Ay"][j]) for k in kn.values()}) for j in range(D + 1)]
    c_i = sum(1 for w in words for v in w if v in S)
    c_ii = 0; c_ii_zero = 0
    for t in rows:
        for j in range(D + 1):
            ej = int(t["pub"][10 + j])
            for y in ys[j]:
                m = (ej - y) % P; c_ii_zero += int(m == 0); c_ii += int(m in S)
    c_iii = 0
    for t in rows:
        y = chain_y(kn, t["agent"]); ms = [(int(t["pub"][10 + j]) - y[j]) % P for j in range(D + 1)]; c_iii += len(ms) - len(set(ms))
    c_iv = sum(1 for t in rows for v in (int(t["pub"][16]), int(t["pub"][17])) if v in S)
    return {"transcripts": len(rows), "agents_in_knowledge": len(kn), "dictionary_values_incl_negations": len(S), "candidate_y_per_position": [len(x) for x in ys],
            "i_transcript_word_in_dictionary": c_i, "ii_residual_zero": c_ii_zero, "ii_residual_in_dictionary": c_ii, "ii_residuals_checked": len(rows) * sum(len(x) for x in ys),
            "iii_equal_masks_true_chain": c_iii, "iv_nf_or_cm_change_in_dictionary": c_iv}

if __name__ == "__main__":
    mode = sys.argv[1]; B = int(sys.argv[2]) if len(sys.argv) > 2 else 5000
    if mode == "d3": print(json.dumps(d3(), indent=1))
    elif mode == "m1": print(json.dumps(m1(B, int(sys.argv[3]) if len(sys.argv) > 3 else 6), indent=1))
    elif mode == "m2": print(json.dumps(m2(B), indent=1))
    elif mode == "m3": print(json.dumps(m2(B, verifier=True), indent=1))
