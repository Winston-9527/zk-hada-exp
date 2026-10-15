# T5c I1 statistics (PREREGISTRATION.md "Statistics"): run-level responses, two-factor Freedman-Lane permutation test of the rate x Delta interaction
# (residuals of the additive model permuted, 10,000 permutations, seed 0), interaction SS share of total SS, Holm over the three responses.
# usage: python3 analyze_i1.py > results/stats.json   (numpy only)
import json, glob, numpy as np
runs = [json.load(open(f)) for f in sorted(glob.glob("results/runs/r*-d*/*.json"))]
def resp(d):
    fr = d["free"]; ex = d["exposure"]
    return {"denial_rate": fr["transient_denials"] / fr["demanded"], "attempts_per_accepted": fr["attempts_per_accepted"],
            "mean_exposure_s": (np.mean([e["last_after_s"] or 0 for e in ex]) if ex else None)}
def design(levA, levB, a, b, inter):
    cols = [np.ones(len(a))] + [(a == x).astype(float) for x in levA[1:]] + [(b == x).astype(float) for x in levB[1:]]
    if inter: cols += [((a == x) & (b == y)).astype(float) for x in levA[1:] for y in levB[1:]]
    return np.column_stack(cols)
def ss_res(X, y): beta, *_ = np.linalg.lstsq(X, y, rcond=None); r = y - X @ beta; return float(r @ r), X @ beta, r
def fl_test(a, b, y, B=10000, seed=0):
    levA, levB = sorted(set(a)), sorted(set(b)); X0, X1 = design(levA, levB, a, b, False), design(levA, levB, a, b, True)
    s0, fit0, r0 = ss_res(X0, y); s1, _, _ = ss_res(X1, y); obs = s0 - s1; tot = float(((y - y.mean()) ** 2).sum())
    rng = np.random.default_rng(seed); cnt = 0
    for _ in range(B):
        yp = fit0 + rng.permutation(r0); a0, _, _ = ss_res(X0, yp); a1, _, _ = ss_res(X1, yp); cnt += (a0 - a1) >= obs - 1e-12
    return {"interaction_SS": obs, "share_of_total_SS": obs / tot if tot > 0 else None, "p": (1 + cnt) / (1 + B), "n": len(y)}
R = [resp(d) for d in runs]; rate = np.array([d["rate"] for d in runs]); dlt = np.array([d["delta_epochs"] for d in runs])
out = {}
for k in ("denial_rate", "attempts_per_accepted"): out[k] = fl_test(rate, dlt, np.array([r[k] for r in R]))
m = rate > 0; out["mean_exposure_s"] = fl_test(rate[m], dlt[m], np.array([R[i]["mean_exposure_s"] for i in np.flatnonzero(m)]))
ps = [out[k]["p"] for k in out]; order = np.argsort(ps); adj = [0] * 3; run = 0
for rank, i in enumerate(order): run = max(run, min(1, (3 - rank) * ps[i])); adj[i] = run
for k, a in zip(out, adj): out[k]["holm_p"] = a
cells = {}
for d, r in zip(runs, R):
    c = cells.setdefault(f"r{d['rate']}-d{d['delta_epochs']}", {k: [] for k in r}); [c[k].append(v) for k, v in r.items()]
out["cells"] = {c: {k: ([float(np.mean(v)), float(np.std(v, ddof=1))] if None not in v else None) for k, v in x.items()} for c, x in cells.items()}
out["hard"] = {"H1_total": sum(d["H1_accepted_after_window"] for d in runs), "H2_total": sum(d["H2_strictly_denied_free_agents"] for d in runs), "runs": len(runs)}
print(json.dumps(out, indent=1))
