# E6b analysis exactly as pre-registered (PREREGISTRATION.md "Tests", "Positive controls").
# usage: .venv/bin/python analyze.py deterministic > results/deterministic.json ; .venv/bin/python analyze.py classify > results/classifiers.json
import json, sys, itertools, random, warnings
warnings.filterwarnings("ignore", category=RuntimeWarning)   # numpy 2.1 + Accelerate emits spurious matmul warnings on macOS; results are finite (checked)
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.metrics import roc_auc_score

P = 21888242871839275222246405745257275088548364400416034343698204186575808495617
load = lambda v: [json.loads(l) for l in open(f"results/transcripts_{v}.jsonl") if l.strip()]
def words(t):
    w = [int(x, 0) for x in t["proof"]] + [int(x, 0) for x in t["pub"]] + [int(x, 0) for x in t["roots"]]
    if "tag" in t: w.append(int(t["tag"], 0))
    return w
# positions: proof 0..7, pub 8..27 (pub index = pos - 8), roots 28..30, tag 31
CT = [8 + i for i in range(6, 16)]          # pub[6..15] = c1x c1y c2x c2y e0..e4 esign (D = 4: 6 + 4 = 10 words)
PROOF = list(range(8))

def nonconstant(rows):
    W = [words(t) for t in rows]; n = len(W[0])
    return [p for p in range(n) if len({w[p] for w in W}) > 1], [p for p in range(n) if len({w[p] for w in W}) == 1]

def deterministic(rows):
    nc, const = nonconstant(rows); W = [words(t) for t in rows]
    seen = {}; shared = 0
    for i, w in enumerate(W):
        for p in nc:
            seen.setdefault(w[p], set()).add(i)
    shared = sum(1 for v, s in seen.items() if len(s) > 1)
    diffs = {}
    for i, w in enumerate(W):
        for a, b in itertools.combinations(CT, 2):
            diffs.setdefault((a, b, (w[a] - w[b]) % P), set()).add(i)
    shared_diff = sum(1 for s in diffs.values() if len(s) > 1)
    nf = {int(t["pub"][17]) for t in rows}; cm = {int(t["pub"][18]) for t in rows}
    return {"transcripts": len(rows), "nonconstant_positions": nc, "constant_positions": const,
            "D1_word_values_shared_by_two_or_more_transcripts": shared, "D2_equal_ciphertext_differences_across_transcripts": shared_diff,
            "D2_budget_nf_equal_to_any_cm_change": len(nf & cm), "D2_distinct_budget_nf": len(nf), "D2_identical_transcripts": len(rows) - len({tuple(words(t)) for t in rows})}

low = lambda x: x & ((1 << 64) - 1)
ham = lambda a, b: bin(low(a) ^ low(b)).count("1")
def pair_features(wa, wb, nc):
    f = []
    for p in nc:
        f += [ham(wa[p], wb[p]), int((wa[p] & 0xFFFF) == (wb[p] & 0xFFFF))] + [wa[p] % q for q in (2, 3, 5, 7)] + [wb[p] % q for q in (2, 3, 5, 7)]
    for grp in (CT, PROOF):
        g = [p for p in grp if p in nc]
        for a, b in itertools.combinations(g, 2):
            da, db = (wa[a] - wa[b]) % P, (wb[a] - wb[b]) % P
            f += [ham(da, db), int((da & 0xFFFF) == (db & 0xFFFF))]
    return f
def single_features(w, nc):
    return [(low(w[p]) >> k) & 1 for p in nc for k in range(64)]

MODELS = {"logreg": lambda s: make_pipeline(StandardScaler(), LogisticRegression(C=1.0, max_iter=2000, random_state=0)),
          "rf": lambda s: RandomForestClassifier(n_estimators=300, random_state=0, n_jobs=-1),
          "knn": lambda s: make_pipeline(StandardScaler(), KNeighborsClassifier(n_neighbors=15))}

def folds_of(units, seed, k=5):
    u = sorted(set(units)); random.Random(f"fold-{seed}").shuffle(u)
    return {x: i % k for i, x in enumerate(u)}

def oof(X, y, fold_a, fold_b, model):
    """out-of-fold scores; a pair is test in fold f iff both members' units are in f; mixed pairs are never used"""
    s = np.full(len(y), np.nan)
    for f in sorted(set(fold_a)):
        te = (fold_a == f) & (fold_b == f); tr = (fold_a != f) & (fold_b != f)
        if te.sum() == 0 or len(set(y[tr])) < 2: continue
        m = MODELS[model](0); m.fit(X[tr], y[tr]); s[te] = m.predict_proba(X[te])[:, 1]
    ok = ~np.isnan(s); return s[ok], y[ok]

def boot_ci(y, s, seed=0, B=2000):
    r = np.random.default_rng(seed); n = len(y); a = []
    for _ in range(B):
        i = r.integers(0, n, n)
        if len(set(y[i])) == 2: a.append(roc_auc_score(y[i], s[i]))
    return [float(np.percentile(a, 2.5)), float(np.percentile(a, 97.5))]

def make_pairs(rows, task, seed, n_each=1792):
    r = random.Random(f"pairs-{task}-{seed}"); idx = list(range(len(rows))); pos, neg = [], []
    key_unit = (lambda t: t["agent"]) if task == "C1" else (lambda t: t["parent"])
    while len(pos) < n_each or len(neg) < n_each:
        i, j = r.sample(idx, 2); a, b = rows[i], rows[j]
        if task == "C1": lab = 1 if a["agent"] == b["agent"] else 0
        else:
            if a["agent"] == b["agent"]: continue
            lab = 1 if a["parent"] == b["parent"] else 0
        if lab and len(pos) < n_each: pos.append((i, j))
        if not lab and len(neg) < n_each: neg.append((i, j))
    return pos, neg, key_unit

def run_pairs(rows, task, seed, perms):
    nc, _ = nonconstant(rows); W = [words(t) for t in rows]
    pos, neg, ku = make_pairs(rows, task, seed)
    pairs = [(p, 1) for p in pos] + [(p, 0) for p in neg]
    X = np.array([pair_features(W[i], W[j], nc) for (i, j), _ in pairs], dtype=float); y = np.array([l for _, l in pairs])
    fo = folds_of([ku(t) for t in rows], seed)
    fa = np.array([fo[ku(rows[i])] for (i, j), _ in pairs]); fb = np.array([fo[ku(rows[j])] for (i, j), _ in pairs])
    # amendment A1: permute at the label's unit (C1: agent of each transcript; C2: parent of each agent), counts preserved
    def null_labels(rng):
        if task == "C1":
            lab = [t["agent"] for t in rows]; rng.shuffle(lab)
            return np.array([int(lab[i] == lab[j]) for (i, j), _ in pairs])
        agents = sorted({t["agent"] for t in rows}); par = [next(t["parent"] for t in rows if t["agent"] == a) for a in agents]; rng.shuffle(par)
        pm = dict(zip(agents, par)); return np.array([int(pm[rows[i]["agent"]] == pm[rows[j]["agent"]]) for (i, j), _ in pairs])
    return evaluate(X, y, fa, fb, seed, perms, null_labels)

def run_single(rows, seed, perms):
    nc, _ = nonconstant(rows); W = [words(t) for t in rows]
    X = np.array([single_features(w, nc) for w in W], dtype=float); y = np.array([1 if t["master"] == "M1" else 0 for t in rows])
    fo = folds_of([t["parent"] for t in rows], seed); f = np.array([fo[t["parent"]] for t in rows])
    parents = sorted({t["parent"] for t in rows}); mast = [next(t["master"] for t in rows if t["parent"] == p) for p in parents]
    def null_labels(rng):   # amendment A1: permute the master of each parent (4 / 4 kept)
        m = list(mast); rng.shuffle(m); pm = dict(zip(parents, m)); return np.array([1 if pm[t["parent"]] == "M1" else 0 for t in rows])
    return evaluate(X, y, f, f, seed, perms, null_labels)

def within_fold_auc(X, y, fa, fb, model):
    a = []
    for f in sorted(set(fa)):
        te = (fa == f) & (fb == f); tr = (fa != f) & (fb != f)
        if len(set(y[te])) < 2 or len(set(y[tr])) < 2: continue
        m = MODELS[model](0); m.fit(X[tr], y[tr]); a.append(roc_auc_score(y[te], m.predict_proba(X[te])[:, 1]))
    return float(np.mean(a)) if a else None

def evaluate(X, y, fa, fb, seed, perms, null_labels):
    out = {}
    for name in MODELS:
        s, yy = oof(X, y, fa, fb, name); auc = float(roc_auc_score(yy, s))
        null = []
        rng = random.Random(f"perm-{seed}-{name}")
        for _ in range(perms):
            yp = null_labels(rng); sp, ypp = oof(X, yp, fa, fb, name)
            if len(set(ypp)) == 2: null.append(roc_auc_score(ypp, sp))
        p = (1 + sum(1 for a in null if a >= auc)) / (1 + len(null)) if null else None
        out[name] = {"auc": auc, "within_fold_auc": within_fold_auc(X, y, fa, fb, name), "ci95": boot_ci(yy, s, seed), "n_test": int(len(yy)), "perm_p": p, "perm_null_mean": float(np.mean(null)) if null else None, "perms": len(null)}
    return out

def holm(ps):
    o = sorted(range(len(ps)), key=lambda i: ps[i]); adj = [0] * len(ps); m = 0
    for k, i in enumerate(o): m = max(m, min(1, (len(ps) - k) * ps[i])); adj[i] = m
    return adj

if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "deterministic":
        print(json.dumps({v: deterministic(load(v)) for v in ("fresh", "p1", "p2")}, indent=1))
    else:
        perms = int(sys.argv[2]) if len(sys.argv) > 2 else 100
        fresh, p1, p2 = load("fresh"), load("p1"), load("p2"); res = {"perms": perms, "seeds": {}}
        for seed in (0, 1, 2):
            r = {"C1_same_agent": run_pairs(fresh, "C1", seed, perms), "C2_sibling": run_pairs(fresh, "C2", seed, perms), "C3_master": run_single(fresh, seed, perms),
                 "P1_C1_randomness_reuse": run_pairs(p1, "C1", seed, perms), "P2_C2_lineage_tag": run_pairs(p2, "C2", seed, perms)}
            keys = [(t, m) for t in ("C1_same_agent", "C2_sibling", "C3_master") for m in MODELS]
            adj = holm([r[t][m]["perm_p"] for t, m in keys])
            for (t, m), a in zip(keys, adj): r[t][m]["holm_p"] = a
            r["decision"] = {f"{t}/{m}": ("LINK" if (r[t][m]["holm_p"] < 0.01 and r[t][m]["ci95"][0] > 0.55) else "no link detected") for t, m in keys}
            r["controls_detected"] = {f"{t}/{m}": bool(r[t][m]["ci95"][0] > 0.55 and r[t][m]["perm_p"] < 0.01) for t in ("P1_C1_randomness_reuse", "P2_C2_lineage_tag") for m in MODELS}
            res["seeds"][seed] = r; print(f"seed {seed} done", file=sys.stderr)
        print(json.dumps(res, indent=1))
