# E6d analysis (PREREGISTRATION.md + amendment A1). Features = E6b analyze.py pair_features (same definition, D-aware ciphertext group, vectorised;
# equality with E6b's function checked by `check`). Per world and task: one unit split, model trained once on train-side pairs, test-side AUC;
# null = the whole test procedure re-run on a unit-level permutation of the test labels (pairs re-sampled, features recomputed, scores re-predicted).
# usage (E6b venv): python analyze_e6d.py check | deterministic | classify [B=1000] [workers=8]
import json, sys, os, random, itertools, importlib.util, warnings, hashlib
warnings.filterwarnings("ignore", category=RuntimeWarning)
import numpy as np
from scipy.stats import chi2, t as tdist
from sklearn.metrics import roc_auc_score

HERE = os.path.dirname(os.path.abspath(__file__)); E6B = os.path.join(HERE, "../E6b-linkability-v9_20261010")
spec = importlib.util.spec_from_file_location("e6b", os.path.join(E6B, "analyze.py")); A = importlib.util.module_from_spec(spec); spec.loader.exec_module(A)
P = A.P; MODELS = A.MODELS; WORLDS = range(1, 9); TASKS = ("C1", "C2"); EPS = (0.0, 0.30, 0.40, 0.45, 0.48); CHANNELS = ("W1", "W2", "W3")
N_EACH = 1792
seed32 = lambda tag: int.from_bytes(hashlib.sha256(tag.encode()).digest()[:4], "big")      # stable across processes (Python hash() is salted)
DATA = os.environ.get("E6D_DATA", os.path.join(HERE, "results"))
load = lambda w: [json.loads(l) for l in open(os.path.join(DATA, f"world_w{w}.jsonl")) if l.strip()]

def base_words(t): return [int(x, 0) for x in t["proof"]] + [int(x, 0) for x in t["pub"]] + [int(x, 0) for x in t["roots"]]
def ct_positions(D): return [8 + i for i in range(6, 12 + D)]          # pub[6 .. 11 + D] = c1x c1y c2x c2y e[0..D] esign (D + 6 words)
PROOF = list(range(8))

# ---------------- leak injection (PREREGISTRATION.md "Weak-leak positive controls") ----------------
def unit_of(t, task): return t["agent"] if task == "C1" else t["parent"]
def inject(rows, W, w, task, channel, eps):
    """returns new word lists; the effective bit of a transcript = its unit's bit, flipped with probability eps"""
    if channel is None: return [list(x) for x in W]
    r = random.Random(f"e6d-leak-{w}-{task}"); units = sorted({unit_of(t, task) for t in rows}); bit = {u: r.random() < 0.5 for u in units}
    rf = random.Random(f"e6d-leakflip-{w}-{task}-{channel}-{eps}"); out = []
    for t, x in zip(rows, W):
        b = int(bit[unit_of(t, task)] ^ (rf.random() < eps)); x = list(x)
        if channel == "W1": x.append((rf.getrandbits(63) << 1) | b)
        elif channel == "W2": x[9] = x[9] + 30 * b                       # pub[1] = now
        elif channel == "W3": x.append(b)
        out.append(x)
    return out

# ---------------- vectorised E6b pair features ----------------
MASK64 = (1 << 64) - 1
def precompute(W, D):
    n = len(W); npos = len(W[0]); nc = [p for p in range(npos) if len({x[p] for x in W}) > 1]
    ct = [p for p in ct_positions(D) if p in nc]; pf = [p for p in PROOF if p in nc]
    combos = [(a, b) for g in (ct, pf) for a, b in itertools.combinations(g, 2)]
    low = np.array([[x[p] & MASK64 for p in nc] for x in W], dtype=np.uint64)
    l16 = np.array([[x[p] & 0xFFFF for p in nc] for x in W], dtype=np.int64)
    mods = np.array([[[x[p] % q for q in (2, 3, 5, 7)] for p in nc] for x in W], dtype=np.int64)     # n × |nc| × 4
    dl = np.array([[((x[a] - x[b]) % P) & MASK64 for a, b in combos] for x in W], dtype=np.uint64).reshape(n, len(combos))
    d16 = np.array([[((x[a] - x[b]) % P) & 0xFFFF for a, b in combos] for x in W], dtype=np.int64).reshape(n, len(combos))
    # A1 item 4: arithmetic features for small numeric words (all values < 2^53: now, q_spent, injected 0/1 words): |a - b|, a and b mod 60 and mod 600,
    # and the residual differences |a mod 60 - b mod 60|, |a mod 600 - b mod 600| (a timing attacker's period residuals)
    small = [k for k, p in enumerate(nc) if max(x[p] for x in W) < 2**53]
    sv = np.array([[x[nc[k]] for k in small] for x in W], dtype=np.float64).reshape(n, len(small))
    return {"nc": nc, "combos": combos, "low": low, "l16": l16, "mods": mods, "dl": dl, "d16": d16, "sv": sv}
def featurize(F, I, J):
    ham = np.bitwise_count(F["low"][I] ^ F["low"][J]).astype(np.int64); eq = (F["l16"][I] == F["l16"][J]).astype(np.int64)
    per = np.concatenate([ham[:, :, None], eq[:, :, None], F["mods"][I], F["mods"][J]], axis=2).reshape(len(I), -1)   # per position: ham, eq, 4 mods a, 4 mods b
    dh = np.bitwise_count(F["dl"][I] ^ F["dl"][J]).astype(np.int64); de = (F["d16"][I] == F["d16"][J]).astype(np.int64)
    dif = np.stack([dh, de], axis=2).reshape(len(I), -1)
    a, b = F["sv"][I], F["sv"][J]
    ar = np.concatenate([np.abs(a - b), np.mod(a, 60), np.mod(b, 60), np.mod(a, 600), np.mod(b, 600),
                         np.abs(np.mod(a, 60) - np.mod(b, 60)), np.abs(np.mod(a, 600) - np.mod(b, 600))], axis=1)
    return np.concatenate([per, dif, ar], axis=1).astype(float)

# Amendment A2 (POST HOC, secondary; opt-in with E6D_FEATS=a2, default = A1 features unchanged): per non-constant position, the agreement of each of
# the low 64 bits, [bit_k(a) == bit_k(b)], k = 0..63 (the pairwise analogue of E6b's single_features), appended after the A1 features; float32 (memory).
FEATS = os.environ.get("E6D_FEATS", "a1")
def bit_agreement(F, I, J):
    x = np.ascontiguousarray(F["low"][I] ^ F["low"][J]).astype("<u8")
    return 1 - np.unpackbits(x.view(np.uint8).reshape(len(I), -1), axis=1, bitorder="little").astype(np.float32)   # bit k of position p at p * 64 + k
featurize_a1 = featurize
if FEATS == "a2":
    def featurize(F, I, J): return np.concatenate([featurize_a1(F, I, J).astype(np.float32), bit_agreement(F, I, J)], axis=1)

# ---------------- pairs ----------------
ROUND = None                                                            # set per world: round of each transcript (amendment A1 item 3)
def sample_pairs(units_arr, agent_arr, round_arr, task, rng, n_each=N_EACH):
    """indices into the given (local) arrays. Positives: a unit uniformly, then two distinct members; negatives: two transcripts of different units.
    C1: both members from different rounds (A1 item 3). C2: different agents. Vectorised rejection sampling (same distribution as one-at-a-time)."""
    ulist = np.unique(units_arr); n = len(units_arr)
    sizes = {int((units_arr == u).sum()) for u in ulist}
    if len(sizes) != 1: raise ValueError("units of unequal size")      # true for every world and side by construction (16 per agent, 8 agents x 16 per parent or 4 x 16)
    Mem = np.stack([np.flatnonzero(units_arr == u) for u in ulist]); S = Mem.shape[1]
    def ok(a, b):
        m = a != b
        if task == "C1": m &= round_arr[a] != round_arr[b]
        else: m &= agent_arr[a] != agent_arr[b]
        return m
    pa, pb = [], []
    while sum(len(x) for x in pa) < n_each:
        u = rng.integers(0, len(ulist), 4 * n_each); a = Mem[u, rng.integers(0, S, 4 * n_each)]; b = Mem[u, rng.integers(0, S, 4 * n_each)]
        k = ok(a, b); pa.append(a[k]); pb.append(b[k])
    pa = np.concatenate(pa)[:n_each]; pb = np.concatenate(pb)[:n_each]
    na, nb = [], []
    while sum(len(x) for x in na) < n_each:
        a = rng.integers(0, n, 4 * n_each); b = rng.integers(0, n, 4 * n_each); k = ok(a, b) & (units_arr[a] != units_arr[b]); na.append(a[k]); nb.append(b[k])
    na = np.concatenate(na)[:n_each]; nb = np.concatenate(nb)[:n_each]
    return np.concatenate([pa, na]), np.concatenate([pb, nb]), np.array([1] * n_each + [0] * n_each)

def split_units(rows, w, task):
    units = sorted({unit_of(t, task) for t in rows}); random.Random(f"e6d-split-{w}-{task}").shuffle(units); h = len(units) // 2
    return set(units[:h]), set(units[h:])


def cluster_ci(y, s, ua, ub, seed, B=2000):
    units = sorted(set(ua) | set(ub)); pos = {u: k for k, u in enumerate(units)}; r = np.random.default_rng(seed); out = []
    ia = np.array([pos[u] for u in ua]); ib = np.array([pos[u] for u in ub])
    for _ in range(B):
        c = np.bincount(r.integers(0, len(units), len(units)), minlength=len(units)); wgt = c[ia] * c[ib]; k = wgt > 0
        if len(set(y[k])) == 2: out.append(roc_auc_score(y[k], s[k], sample_weight=wgt[k]))
    return [float(np.percentile(out, 2.5)), float(np.percentile(out, 97.5))]

def one_test(rows, F, w, task, B, label):
    """A1 item 1: the model is trained once; every test pair that can ever be sampled (all eligible pairs of test transcripts) is scored once;
    the observed AUC and each of the B null AUCs re-sample pairs (true resp. unit-permuted labels) and look the scores up. Same procedure as
    re-scoring, because a fixed model gives a pair the same score."""
    agent_of = np.array([t["agent"] for t in rows]); unit = np.array([unit_of(t, task) for t in rows]); rnd_of = np.array([t["round"] for t in rows])
    tr_u, te_u = split_units(rows, w, task); tr = np.array([i for i in range(len(rows)) if unit[i] in tr_u]); te = np.array([i for i in range(len(rows)) if unit[i] in te_u])
    I, J, ytr = sample_pairs(unit[tr], agent_of[tr], rnd_of[tr], task, np.random.default_rng(seed32(f"e6d-pairs-{w}-{task}-train")))
    Xtr = featurize(F, tr[I], tr[J])
    # pool: all unordered eligible pairs of test transcripts
    n = len(te); ii, jj = np.triu_indices(n, 1); ua, aa, ra = unit[te], agent_of[te], rnd_of[te]
    elig = (ra[ii] != ra[jj]) if task == "C1" else (aa[ii] != aa[jj]); ii, jj = ii[elig], jj[elig]
    PI = np.full((n, n), -1, dtype=np.int64); PI[ii, jj] = np.arange(len(ii)); PI[jj, ii] = np.arange(len(ii))
    Xpool = featurize(F, te[ii], te[jj]).astype(np.float32)
    te_agents = sorted(set(aa)); parent_of_agent = {t["agent"]: t["parent"] for t in rows}
    scores = {}
    for name in MODELS:
        m = MODELS[name](0)
        if name == "rf": m.set_params(n_jobs=1)
        m.fit(Xtr, ytr); scores[name] = m.predict_proba(Xpool)[:, 1]
    def draw(units_local, rng):
        a, b, y = sample_pairs(units_local, aa, ra, task, rng); return PI[a, b], y, a, b
    k0, y0, a0, b0 = draw(ua, np.random.default_rng(seed32(f"e6d-pairs-{w}-{task}-test")))
    prng = random.Random(f"e6d-perm-{w}-{task}-{label}"); null = {nm: [] for nm in MODELS}
    for _ in range(B):
        if task == "C1":
            lab = list(ua); prng.shuffle(lab); umap = np.array(lab)
        else:
            par = [parent_of_agent[x] for x in te_agents]; prng.shuffle(par); pa = dict(zip(te_agents, par)); umap = np.array([pa[x] for x in aa])
        k, y, _, _ = draw(umap, np.random.default_rng(prng.getrandbits(32)))
        for nm in MODELS: null[nm].append(roc_auc_score(y, scores[nm][k]))
    out = {}
    for nm in MODELS:
        auc = roc_auc_score(y0, scores[nm][k0]); nl = np.array(null[nm]); p = (1 + int((nl >= auc).sum())) / (1 + B)
        out[nm] = {"auc": float(auc), "p": p, "null_mean": float(nl.mean()), "null_q99": float(np.quantile(nl, 0.99)),
                   "ci95_cluster": cluster_ci(y0, scores[nm][k0], aa[a0], aa[b0], 0), "n_train_pairs": int(len(ytr)), "n_test_pairs": int(len(y0)), "pool_pairs": int(len(ii))}
    return out

def holm(ps): return A.holm(ps)
def fisher(ps): x = -2 * float(np.sum(np.log(ps))); return float(chi2.sf(x, 2 * len(ps)))

def world_job(args):
    w, B = args; rows = load(w); D = rows[0]["D"]; W0 = [base_words(t) for t in rows]; res = {}
    variants = [("fresh", None, 0.0)] + [(f"{c}_eps{e}", c, e) for c in CHANNELS for e in EPS]
    for task in TASKS:
        res[task] = {}
        for label, ch, eps in variants:
            F = precompute(inject(rows, W0, w, task, ch, eps), D); res[task][label] = one_test(rows, F, w, task, B, label)
        print(f"w{w} {task} done", file=sys.stderr, flush=True)
    return w, res

def deterministic_world(w):
    rows = load(w); D = rows[0]["D"]; W = [base_words(t) for t in rows]; n = len(W[0])
    # A1 item 2: L-words (now, ctx_hash, req_cap, tpk, state_root, note_root, q_spent, roots) carry public, i.i.d. action data and may repeat by design;
    # D1 looks at the words that must never repeat: proof, ciphertext, budget_nf, cm_change
    nonL = PROOF + ct_positions(D) + [8 + 13 + D, 8 + 14 + D]
    nc = [p for p in nonL if len({x[p] for x in W}) > 1]; seen = {}
    for i, x in enumerate(W):
        for p in nc: seen.setdefault(x[p], set()).add(i)
    ct = ct_positions(D); diffs = {}
    for i, x in enumerate(W):
        for a, b in itertools.combinations(ct, 2): diffs.setdefault((a, b, (x[a] - x[b]) % P), set()).add(i)
    nf = {x[8 + 13 + D] for x in W}; cm = {x[8 + 14 + D] for x in W}
    return {"D": D, "transcripts": len(rows), "D1_positions": len(nc), "D1_shared_values": sum(1 for s in seen.values() if len(s) > 1),
            "D2_equal_ciphertext_differences": sum(1 for s in diffs.values() if len(s) > 1), "D2_budget_nf_equal_cm_change": len(nf & cm), "distinct_budget_nf": len(nf),
            "identical_transcripts": len(rows) - len({tuple(x) for x in W})}

if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "check":     # vectorised features == E6b pair_features (with this world's ciphertext group) on 300 random pairs per world
        bad = 0; tot = 0
        for w in WORLDS:
            if not os.path.exists(os.path.join(DATA, f"world_w{w}.jsonl")): continue
            rows = load(w); D = rows[0]["D"]; W0 = [base_words(t) for t in rows]; F = precompute(W0, D); A.CT = ct_positions(D)
            r = np.random.default_rng(w); I = r.integers(0, len(rows), 300); J = r.integers(0, len(rows), 300); X = featurize(F, I, J)
            for k in range(300):
                ref = np.array(A.pair_features(W0[I[k]], W0[J[k]], F["nc"]), dtype=float); tot += 1; bad += int(not np.array_equal(X[k][:len(ref)], ref))   # E6b part = prefix
        print(json.dumps({"pairs_checked": tot, "mismatches": bad}))
    elif mode == "check_a2":    # A2 features: A1 features are the prefix; the bit block equals a direct per-bit comparison
        bad = tot = 0
        for w in WORLDS:
            rows = load(w); D = rows[0]["D"]; W0 = [base_words(t) for t in rows]; F = precompute(W0, D)
            r = np.random.default_rng(100 + w); I = r.integers(0, len(rows), 300); J = r.integers(0, len(rows), 300); X = featurize(F, I, J); X1 = featurize_a1(F, I, J); k1 = X1.shape[1]
            for k in range(300):
                ref = np.array([int(((W0[I[k]][p] >> b) & 1) == ((W0[J[k]][p] >> b) & 1)) for p in F["nc"] for b in range(64)], dtype=np.float32)
                tot += 1; bad += int(not (np.array_equal(X[k][:k1], X1[k].astype(np.float32)) and np.array_equal(X[k][k1:], ref)))
        print(json.dumps({"feats": FEATS, "pairs_checked": tot, "mismatches": bad}))
    elif mode == "deterministic":
        print(json.dumps({f"w{w}": deterministic_world(w) for w in WORLDS}, indent=1))
    else:
        B = int(sys.argv[2]) if len(sys.argv) > 2 else 1000; workers = int(sys.argv[3]) if len(sys.argv) > 3 else 8
        from multiprocessing import Pool
        with Pool(workers) as pool: per = dict(pool.map(world_job, [(w, B) for w in WORLDS]))
        variants = ["fresh"] + [f"{c}_eps{e}" for c in CHANNELS for e in EPS]; comb = {}
        for v in variants:
            cells = [(task, m) for task in TASKS for m in MODELS]; ps = [fisher([per[w][task][v][m]["p"] for w in WORLDS]) for task, m in cells]; adj = holm(ps)
            comb[v] = {}
            for (task, m), p, a in zip(cells, ps, adj):
                aucs = np.array([per[w][task][v][m]["auc"] for w in WORLDS]); se = aucs.std(ddof=1) / np.sqrt(len(aucs)); q = tdist.ppf(0.975, len(aucs) - 1)
                comb[v][f"{task}/{m}"] = {"fisher_p": p, "holm_p": a, "detected": bool(a < 0.01), "per_world_p_lt_0.01": int(sum(per[w][task][v][m]["p"] < 0.01 for w in WORLDS)),
                                          "mean_auc": float(aucs.mean()), "mean_auc_ci95": [float(aucs.mean() - q * se), float(aucs.mean() + q * se)]}
        mde = {}
        for c in CHANNELS:
            for task in TASKS:
                ok = [e for e in EPS if any(comb[f"{c}_eps{e}"][f"{task}/{m}"]["detected"] and comb[f"{c}_eps{e}"][f"{task}/{m}"]["per_world_p_lt_0.01"] >= 7 for m in MODELS)]
                mde[f"{c}/{task}"] = {"largest_eps_detected": max(ok) if ok else None, "agreement_1_minus_eps": (1 - max(ok)) if ok else None,
                                      "void": not any(comb[f"{c}_eps0.0"][f"{task}/{m}"]["detected"] for m in MODELS)}
        print(json.dumps({"B": B, "feats": FEATS, "link_decision": {k: v["detected"] for k, v in comb["fresh"].items()}, "combined": comb, "mde": mde, "per_world": per}, indent=1))
