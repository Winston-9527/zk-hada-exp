# E6b2 analysis (PREREGISTRATION.md, amendment A2). Reuses E6b's analyze.py (features, models, folds, pairs, unit-level null) read-only.
# usage (from this directory): ../E6b-linkability-v9_20261010/.venv/bin/python analyze2.py classify 1000 > results/classifiers_a2.json
#                              ../E6b-linkability-v9_20261010/.venv/bin/python analyze2.py c3 > results/c3_exact.json
import json, sys, os, random, itertools, importlib.util, warnings
warnings.filterwarnings("ignore", category=RuntimeWarning)
import numpy as np
from sklearn.metrics import roc_auc_score

E6B = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../E6b-linkability-v9_20261010")
spec = importlib.util.spec_from_file_location("e6b", os.path.join(E6B, "analyze.py")); A = importlib.util.module_from_spec(spec); spec.loader.exec_module(A)
load = lambda v: [json.loads(l) for l in open(os.path.join(E6B, f"results/transcripts_{v}.jsonl")) if l.strip()]

def oof_mask(X, y, fa, fb, model):
    s = np.full(len(y), np.nan)
    for f in sorted(set(fa)):
        te = (fa == f) & (fb == f); tr = (fa != f) & (fb != f)
        if te.sum() == 0 or len(set(y[tr])) < 2: continue
        m = A.MODELS[model](0); m.fit(X[tr], y[tr]); s[te] = m.predict_proba(X[te])[:, 1]
    return s, ~np.isnan(s)

def cluster_ci(y, s, ua, ub, seed, B=2000):
    """resample agents with replacement; pair weight = multiplicity(agent a) * multiplicity(agent b)"""
    units = sorted(set(ua) | set(ub)); r = np.random.default_rng(seed); out = []
    ia = np.array([units.index(u) for u in ua]); ib = np.array([units.index(u) for u in ub])
    for _ in range(B):
        c = np.bincount(r.integers(0, len(units), len(units)), minlength=len(units)); w = c[ia] * c[ib]
        k = w > 0
        if len(set(y[k])) == 2: out.append(roc_auc_score(y[k], s[k], sample_weight=w[k]))
    return [float(np.percentile(out, 2.5)), float(np.percentile(out, 97.5))]

def run_pairs(rows, task, seed, perms):
    nc, _ = A.nonconstant(rows); W = [A.words(t) for t in rows]
    pos, neg, ku = A.make_pairs(rows, task, seed); pairs = [(p, 1) for p in pos] + [(p, 0) for p in neg]
    X = np.array([A.pair_features(W[i], W[j], nc) for (i, j), _ in pairs], dtype=float); y = np.array([l for _, l in pairs])
    fo = A.folds_of([ku(t) for t in rows], seed)
    fa = np.array([fo[ku(rows[i])] for (i, j), _ in pairs]); fb = np.array([fo[ku(rows[j])] for (i, j), _ in pairs])
    ua = [rows[i]["agent"] for (i, j), _ in pairs]; ub = [rows[j]["agent"] for (i, j), _ in pairs]
    def null_labels(rng):   # identical to E6b A1
        if task == "C1":
            lab = [t["agent"] for t in rows]; rng.shuffle(lab); return np.array([int(lab[i] == lab[j]) for (i, j), _ in pairs])
        agents = sorted({t["agent"] for t in rows}); par = [next(t["parent"] for t in rows if t["agent"] == a) for a in agents]; rng.shuffle(par)
        pm = dict(zip(agents, par)); return np.array([int(pm[rows[i]["agent"]] == pm[rows[j]["agent"]]) for (i, j), _ in pairs])
    out = {}
    for name in A.MODELS:
        s, ok = oof_mask(X, y, fa, fb, name); auc = float(roc_auc_score(y[ok], s[ok]))
        rng = random.Random(f"a2-perm-{task}-{seed}-{name}"); null = []
        for _ in range(perms):
            yp = null_labels(rng); sp, okp = oof_mask(X, yp, fa, fb, name)
            if len(set(yp[okp])) == 2: null.append(roc_auc_score(yp[okp], sp[okp]))
        p = (1 + sum(1 for a in null if a >= auc)) / (1 + len(null))
        out[name] = {"auc": auc, "within_fold_auc": A.within_fold_auc(X, y, fa, fb, name),
                     "ci95_cluster": cluster_ci(y[ok], s[ok], np.array(ua)[ok], np.array(ub)[ok], seed), "ci95_pairs_e6b": A.boot_ci(y[ok], s[ok], seed),
                     "n_test": int(ok.sum()), "perm_p": p, "perms": len(null), "perm_null_mean": float(np.mean(null)), "perm_null_q99": float(np.quantile(null, 0.99))}
    return out

def decide(r, tasks):
    keys = [(t, m) for t in tasks for m in A.MODELS]; adj = A.holm([r[t][m]["perm_p"] for t, m in keys])
    for (t, m), a in zip(keys, adj): r[t][m]["holm_p"] = a
    return {f"{t}/{m}": bool(r[t][m]["holm_p"] < 0.01 and r[t][m]["ci95_cluster"][0] > 0.55) for t, m in keys}

def c3_exact(rows, seed):
    nc, _ = A.nonconstant(rows); W = [A.words(t) for t in rows]
    X = np.array([A.single_features(w, nc) for w in W], dtype=float)
    fo = A.folds_of([t["parent"] for t in rows], seed); f = np.array([fo[t["parent"]] for t in rows])
    parents = sorted({t["parent"] for t in rows}); true_m1 = {p for p in parents if next(t["master"] for t in rows if t["parent"] == p) == "M1"}
    res = {}
    for name in A.MODELS:
        dist = []; obs = None
        for m1 in itertools.combinations(parents, 4):
            y = np.array([1 if t["parent"] in m1 else 0 for t in rows]); s, ok = oof_mask(X, y, f, f, name); a = float(roc_auc_score(y[ok], s[ok]))
            dist.append(a); obs = a if set(m1) == true_m1 else obs
        res[name] = {"auc": obs, "labelings": len(dist), "exact_p": sum(1 for a in dist if a >= obs) / len(dist), "min_attainable_p": 2 / len(dist),
                     "null_mean": float(np.mean(dist))}
    return res

if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "c3":
        fresh = load("fresh"); print(json.dumps({"seeds": {s: c3_exact(fresh, s) for s in (0, 1, 2)}}, indent=1))
    else:
        perms = int(sys.argv[2]); fresh, p1, p2 = load("fresh"), load("p1"), load("p2"); res = {"perms": perms, "seeds": {}}
        for seed in (0, 1, 2):
            r = {"C1_same_agent": run_pairs(fresh, "C1", seed, perms), "C2_sibling": run_pairs(fresh, "C2", seed, perms),
                 "P1_C1_randomness_reuse": run_pairs(p1, "C1", seed, perms), "P2_C2_lineage_tag": run_pairs(p2, "C2", seed, perms)}
            r["link"] = decide(r, ("C1_same_agent", "C2_sibling")); r["controls_detected"] = decide(r, ("P1_C1_randomness_reuse", "P2_C2_lineage_tag"))
            r["negative_result_void"] = not all(r["controls_detected"].values())
            res["seeds"][seed] = r; print(f"seed {seed} done", file=sys.stderr, flush=True)
        print(json.dumps(res, indent=1))
