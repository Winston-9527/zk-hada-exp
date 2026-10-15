# E8 summary (PREREGISTRATION.md "Metrics" / "Statistics" + amendment A1). usage (E6b venv, scipy): python summarize.py > results/summary.json
import json, glob, os
from collections import Counter
from scipy.stats import beta
H = os.path.dirname(os.path.abspath(__file__))
def cp(k, n):  # Clopper-Pearson 95 %
    lo = 0.0 if k == 0 else beta.ppf(0.025, k, n - k + 1); hi = 1.0 if k == n else beta.ppf(0.975, k + 1, n - k); return [round(float(lo), 4), round(float(hi), 4)]
L = lambda a: [json.load(open(f)) for f in sorted(glob.glob(f"{H}/results/{a}/*.json"), key=lambda f: int(os.path.basename(f).split(".")[0])) if not f.endswith("failed.json")]
out = {}
def attacks(runs):
    by = {}; layers = Counter(); untestable = 0
    for r in runs:
        for k, v in r["attacks"]["by_kind"].items():
            if v["layer"] == "untestable": untestable += 1; continue
            b = by.setdefault(k, {"n": 0, "blocked": 0, "layers": Counter()}); b["n"] += 1; b["blocked"] += int(v["blocked"]); b["layers"][f'{v["layer"]}: {v["reason"]}'] += 1; layers[v["layer"]] += 1
    n = sum(b["n"] for b in by.values()); k = sum(b["blocked"] for b in by.values())
    return {"n": n, "blocked": k, "blocked_ci95": cp(k, n), "by_kind": {a: {"n": b["n"], "blocked": b["blocked"], "layers": dict(b["layers"])} for a, b in by.items()}, "by_layer": dict(layers), "untestable": untestable}
# ---- A1 ----
r1 = L("A1"); legit = became = 0; committed = failed = uncertain = refused_other = 0; outcomes_planned = Counter(); conc = []
for r in r1:
    perm = [x for x in r["rows"] if x["type"] == "permchange"]; tperm = perm[0]["t"] if perm else 1e9
    for x in r["rows"]:
        if x["type"] != "call": continue
        if x["agent"] == 0 and x["tool"] == "fetch" and x["t"] > tperm: became += 1; assert not x["accepted"]; continue
        legit += 1; outcomes_planned[x.get("outcome_planned") or "refused"] += 1
        if not x["accepted"]: refused_other += 1; continue
        committed += x.get("final") == "commit"; failed += x.get("final") == "fail"; uncertain += x.get("final") == "uncertain"
    conc += [{"first": [f["reason"] for f in c["first"]], "retry_accepted": c["retry_accepted"]} for c in r["concurrent"]]
out["A1"] = {"runs": len(r1), "legit_calls": legit, "reserved": legit - refused_other, "refused_legit": refused_other, "committed": committed, "commit_rate": round(committed / legit, 4), "commit_ci95": cp(committed, legit),
             "failed": failed, "uncertain": uncertain, "uncertain_rate": round(uncertain / legit, 4), "became_unauthorized_after_permchange": became,
             "concurrent": {"n": len(conc), "one_budgetspent_then_retry_ok": sum(1 for c in conc if sorted(map(str, c["first"])) == ["None", "ZkDacGateV9.BudgetSpent"] and c["retry_accepted"])},
             "hard": {k: all(r["hard"][k] for r in r1) for k in r1[0]["hard"]}, "attacks": attacks(r1),
             "stranded_on_old_cert_mean": sum(x["stranded_on_old_cert"] for r in r1 for x in r["rows"] if x["type"] == "permchange") / len(r1)}
# ---- A2 ----
r2 = L("A2"); n = sum(r["legit"]["n"] for r in r2); k = sum(r["legit"]["settled"] for r in r2); at = [a for r in r2 for a in r["atomicity"]]
out["A2"] = {"runs": len(r2), "legit": n, "settled": k, "settled_ci95": cp(k, n), "hard": {h: all(r["hard"][h] for r in r2) for h in r2[0]["hard"]},
             "atomicity": {"n": len(at), "target_revert": sum(1 for a in at if a["first"]["layer"] == "target"), "nullifier_unspent_after_revert": sum(1 for a in at if a["nullifier_unspent_after_revert"]),
                           "vault_unchanged": sum(1 for a in at if a["vault_balance_unchanged"]), "retry_accepted": sum(1 for a in at if a["retry_accepted"])}, "attacks": attacks(r2)}
# ---- A3 ----
r3 = L("A3"); succ = sum(1 for r in r3 if r["task_success"])
out["A3"] = {"runs": len(r3), "task_success": succ, "task_success_ci95": cp(succ, len(r3)), "items_bought_distribution": dict(Counter(r["items_bought"] for r in r3)),
             "spend_le_B_all": all(r["hard"]["spend_le_B"] for r in r3), "unassignable_items_total": sum(r["unassignable_items"] for r in r3), "runs_with_unassignable": sum(1 for r in r3 if r["unassignable_items"]),
             "stranded_budget_mean": round(sum(r["stranded_budget_total"] for r in r3) / len(r3), 2), "slack_mean": round(sum(r["B"] - sum(x["price"] for x in json.load(open(f'{H}/traces/A3/{r["seed"]}.json'))["items"]) for r in r3) / len(r3), 2),
             "transient_retried_total": sum(r["buys"]["transient_retried"] for r in r3), "stuck_total": sum(len(r["buys"]["stuck"]) for r in r3),
             "failed_runs": [{"seed": r["seed"], "items": r["items_bought"], "unassignable": r["unassignable_items"], "stranded": r["stranded_budget_total"], "n": r["n"]} for r in r3 if not r["task_success"]],
             "hard": {"all_attacks_blocked": all(r["hard"]["all_attacks_blocked"] for r in r3)}, "attacks": attacks(r3)}
out["all_attacks_blocked_all_apps"] = all(out[a]["attacks"]["blocked"] == out[a]["attacks"]["n"] for a in ("A1", "A2", "A3"))
print(json.dumps(out, indent=1, default=str))
