# E2b statistics (PREREGISTRATION.md "Metrics", "Statistics"). usage: python3 analyze_e2b.py > results/summary.json   (numpy only)
# Per cell: hard checks, accepted actions/units, stops, attempts, rejection reasons, wasted gas, latency p50/p95 (p99 if >= 300 accepted), effective parallelism,
# max accepted per block, state growth. Primary: effective parallelism B - A paired by seed for k >= 8 (6 comparisons): mean, paired bootstrap 95 % CI
# (10,000 resamples, seed 0), sign-flip permutation p (10,000 flips, seed 0), Holm over the 6.
import json, glob, numpy as np
runs = {}
for f in sorted(glob.glob("results/runs/*/*.json")):
    if "attempt" in f or f.endswith(".failed.json"): continue
    d = json.load(open(f)); runs[(d["cond"], d["k"], d["block_s"], int(d["seed"]))] = d
q = lambda xs, p: float(np.percentile(xs, p)) if len(xs) else None
cells = {}
for (c, k, b) in sorted({key[:3] for key in runs}):
    rs = [runs[(c, k, b, s)] for s in range(30) if (c, k, b, s) in runs]
    lat = [x for r in rs for x in r["latency_s"]]; latb = [x for r in rs for x in r["latency_blocks"]]
    reasons = {}
    for r in rs:
        for kk, v in r["rejections_by_reason"].items(): reasons[kk] = reasons.get(kk, 0) + v
    ep = [r["effective_parallelism"] for r in rs if r["effective_parallelism"] is not None]
    cells[f"{c}-k{k}-b{b}"] = {
        "runs": len(rs),
        "hard": {"accepted_le_budget": all(r["hard"]["accepted_le_budget"] for r in rs), "nf_once": all(r["hard"]["nf_once"] for r in rs),
                 "max_spends_per_nf": max(r["hard"]["max_spends_per_nf"] for r in rs), "events_eq_txs": all(r["hard"]["accepted_events"] == r["hard"]["accepted_txs"] for r in rs)},
        "budget": rs[0]["budget"], "accepted_actions_mean": float(np.mean([r["accepted_actions"] for r in rs])), "accepted_actions_minmax": [min(r["accepted_actions"] for r in rs), max(r["accepted_actions"] for r in rs)],
        "accepted_units_mean": float(np.mean([r["hard"]["accepted_units"] for r in rs])),
        "stops_retry_cap_mean": float(np.mean([r["stops"]["retry_cap"] for r in rs])), "stops_exhausted_mean": float(np.mean([r["stops"]["exhausted"] for r in rs])),
        "attempts_mean": float(np.mean([r["attempts"] for r in rs])), "rejections_by_reason": reasons,
        "wasted_gas_mean": float(np.mean([r["wasted_gas"] for r in rs])), "gas_accepted_mean": float(np.mean([g for r in rs for g in r["gas_accepted"]])),
        "latency_s": {"n": len(lat), "p50": q(lat, 50), "p95": q(lat, 95), "p99": q(lat, 99) if len(lat) >= 300 else None},
        "latency_blocks": {"p50": q(latb, 50), "p95": q(latb, 95)},
        "effective_parallelism": {"mean": float(np.mean(ep)) if ep else None, "sd": float(np.std(ep, ddof=1)) if len(ep) > 1 else None, "n": len(ep)},
        "max_accepted_per_block": max(r["max_accepted_per_block"] for r in rs), "block_order_kept": all(r["block_order_kept"] for r in rs),
        "state": {"note_leaves_mean": float(np.mean([r["state"]["note_leaves"] for r in rs])), "budget_spent_slots_mean": float(np.mean([r["state"]["budget_spent_slots"] for r in rs]))}}
rng = np.random.default_rng(0); comps = {}
for k in (8, 32, 128):
    for b in (1, 2):
        pairs = [(runs[("B", k, b, s)]["effective_parallelism"], runs[("A", k, b, s)]["effective_parallelism"]) for s in range(30) if ("A", k, b, s) in runs and ("B", k, b, s) in runs]
        d = np.array([x - y for x, y in pairs if x is not None and y is not None]); n = len(d)
        boot = [rng.choice(d, n, replace=True).mean() for _ in range(10000)]
        flips = rng.choice([-1, 1], size=(10000, n)); null = np.abs((flips * d).mean(axis=1))
        comps[f"k{k}-b{b}"] = {"n_pairs": n, "mean_diff_B_minus_A": float(d.mean()), "ci95": [float(np.percentile(boot, 2.5)), float(np.percentile(boot, 97.5))],
                               "p": float((1 + (null >= abs(d.mean()) - 1e-15).sum()) / (1 + 10000))}
ks = list(comps); ps = [comps[x]["p"] for x in ks]; order = np.argsort(ps); run = 0
for rank, i in enumerate(order): run = max(run, min(1.0, (len(ps) - rank) * ps[i])); comps[ks[i]]["holm_p"] = run; comps[ks[i]]["significant"] = run < 0.05
hard_all = all(c["hard"]["accepted_le_budget"] and c["hard"]["nf_once"] for c in cells.values())
print(json.dumps({"runs": len(runs), "hard_checks_hold_in_every_run": hard_all, "cells": cells, "primary_B_minus_A_effective_parallelism": comps}, indent=1))
