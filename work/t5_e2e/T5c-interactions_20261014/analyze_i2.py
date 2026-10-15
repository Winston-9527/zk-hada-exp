# T5c I2 statistics (PREREGISTRATION_I2.md "Statistics"): run-level responses (i) mean execute gas, (ii) mean inclusion latency (blocks),
# (iii) per-chain tree gas; Freedman-Lane interaction test f x k (10,000 permutations, seed 0), interaction SS share, Holm over 3. usage: python3 analyze_i2.py
import json, glob, numpy as np
runs = [json.load(open(f)) for f in sorted(glob.glob("results/i2/runs/f*-k*/*.json"))]
def design(la, lb, a, b, inter):
    cols = [np.ones(len(a))] + [(a == x).astype(float) for x in la[1:]] + [(b == x).astype(float) for x in lb[1:]]
    if inter: cols += [((a == x) & (b == y)).astype(float) for x in la[1:] for y in lb[1:]]
    return np.column_stack(cols)
def ssr(X, y): beta, *_ = np.linalg.lstsq(X, y, rcond=None); r = y - X @ beta; return float(r @ r), X @ beta, r
def fl(a, b, y, B=10000):
    la, lb = sorted(set(a)), sorted(set(b)); X0, X1 = design(la, lb, a, b, False), design(la, lb, a, b, True)
    s0, fit0, r0 = ssr(X0, y); s1, _, _ = ssr(X1, y); obs = s0 - s1; tot = float(((y - y.mean()) ** 2).sum()); rng = np.random.default_rng(0); c = 0
    for _ in range(B): yp = fit0 + rng.permutation(r0); c += (ssr(X0, yp)[0] - ssr(X1, yp)[0]) >= obs - 1e-9
    return {"interaction_SS": obs, "share_of_total_SS": obs / tot if tot else None, "p": (1 + c) / (1 + B)}
f = np.array([r["f"] for r in runs]); k = np.array([r["k"] for r in runs])
Y = {"execute_gas_mean": np.array([r["actions"]["gas_mean"] for r in runs]), "latency_blocks_mean": np.array([r["actions"]["latency_blocks_mean"] for r in runs]),
     "per_chain_tree_gas": np.array([r["tree"]["per_chain_tree_gas"] for r in runs])}
out = {n: fl(f, k, y) for n, y in Y.items()}
ps = [out[n]["p"] for n in out]; order = np.argsort(ps); run = 0
for rank, i in enumerate(order): run = max(run, min(1, (3 - rank) * ps[i])); out[list(out)[i]]["holm_p"] = run
cells = {}
for r in runs:
    c = cells.setdefault(f"f{r['f']}-k{r['k']}", {"whole_tree_gas": [], "per_chain_tree_gas": [], "fixed_gas": [], "execute_gas_mean": [], "latency_blocks_mean": [], "blocks_to_include_all": [], "accepted": [], "n": [], "rejected": [], "notes_final": []})
    c["whole_tree_gas"].append(r["tree"]["whole_tree_gas"]); c["per_chain_tree_gas"].append(r["tree"]["per_chain_tree_gas"]); c["fixed_gas"].append(r["tree"]["fixed_gas"])
    c["execute_gas_mean"].append(r["actions"]["gas_mean"]); c["latency_blocks_mean"].append(r["actions"]["latency_blocks_mean"]); c["blocks_to_include_all"] += r["actions"]["blocks_to_include_all"]
    c["accepted"].append(r["actions"]["accepted"]); c["n"].append(r["actions"]["n"]); c["rejected"].append(r["actions"]["rejected_by_reason"]); c["notes_final"].append(r["notes_final"])
summ = {c: {"whole_tree_gas_mean": float(np.mean(v["whole_tree_gas"])), "per_chain_tree_gas_mean": float(np.mean(v["per_chain_tree_gas"])), "fixed_gas_mean": float(np.mean(v["fixed_gas"])),
            "execute_gas_mean": [float(np.mean(v["execute_gas_mean"])), float(np.std(v["execute_gas_mean"], ddof=1))], "latency_blocks_mean": float(np.mean(v["latency_blocks_mean"])),
            "blocks_to_include_all": sorted(set(v["blocks_to_include_all"])), "accepted_total": int(sum(v["accepted"])), "actions_total": int(sum(v["n"])), "rejected": [x for x in v["rejected"] if x],
            "notes_final_mean": float(np.mean(v["notes_final"]))} for c, v in cells.items()}
print(json.dumps({"runs": len(runs), "accepted_all": all(r["actions"]["accepted"] == r["actions"]["n"] for r in runs), "interaction": out, "cells": summ}, indent=1))
