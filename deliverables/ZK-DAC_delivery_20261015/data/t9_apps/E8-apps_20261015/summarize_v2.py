# E8 corrected summary after audit #77 (2026-10-15). Reads the SAME committed run outputs; writes results/summary_v2.json (summary.json is kept).
# Changes vs summarize.py: (1) A3 unassignable items split by cause (planner budget exhausted vs no capable live sub-agent);
# (2) stranded budget includes per-item notes reassigned to a sub-agent that later failed; (3) attack attempts that failed inside the harness
# (JS error: the attacker held no note) are separated from blocks, as amendment A1 does for 'untestable'.
import json, glob, os
from collections import Counter
H = os.path.dirname(os.path.abspath(__file__))
L = lambda a: [json.load(open(f)) for f in sorted(glob.glob(f"{H}/results/{a}/*.json"), key=lambda f: int(os.path.basename(f).split(".")[0])) if not f.endswith("failed.json")]
out = {"A3": {"runs": [], "unassignable_by_cause": Counter(), "stranded_v1_total": 0, "stranded_v2_total": 0}, "attacks": {}}
for r in L("A3"):
    tr = json.load(open(f"{H}/traces/A3/{r['seed']}.json")); price = {x["id"]: x["price"] for x in tr["items"]}
    re = [x for x in r["rows"] if x["type"] == "reassign"]; sent_to = {}; extra = 0; causes = Counter()
    for x in re:
        for m in x["moved"]:
            if m["to"] is None: causes[m.get("why", "no capable live sub-agent")] += 1
            elif m["item"] in sent_to: pass
        # items previously reassigned (with their own note) to the agent that now fails, and still unbought, are stranded too
        extra += sum(price[m["item"]] for m in x["moved"] if sent_to.get(m["item"]) == x["agent"])
        for m in x["moved"]:
            if m["to"] is not None: sent_to[m["item"]] = m["to"]
    out["A3"]["runs"].append({"seed": r["seed"], "task_success": r["task_success"], "items": r["items_bought"], "unassignable": dict(causes), "stranded_v1": r["stranded_budget_total"], "stranded_item_notes": extra})
    out["A3"]["unassignable_by_cause"].update(causes); out["A3"]["stranded_v1_total"] += r["stranded_budget_total"]; out["A3"]["stranded_v2_total"] += r["stranded_budget_total"] + extra
n3 = len(out["A3"]["runs"]); out["A3"]["stranded_v1_mean"] = round(out["A3"]["stranded_v1_total"] / n3, 2); out["A3"]["stranded_v2_mean"] = round(out["A3"]["stranded_v2_total"] / n3, 2)
out["A3"]["failed_runs"] = [x for x in out["A3"]["runs"] if not x["task_success"]]
for app in ("A1", "A2", "A3"):
    k = Counter()
    for r in L(app):
        for kind, v in r["attacks"]["by_kind"].items():
            if v["layer"] == "untestable": k["untestable"] += 1
            elif v["layer"] == "construction" and "Cannot read properties of null" in (v["reason"] or ""): k["harness_error_no_note"] += 1
            elif v["blocked"]: k[f"blocked_{v['layer']}"] += 1
            else: k["accepted"] += 1
    out["attacks"][app] = dict(k)
out["attacks"]["blocked_by_circuit_or_gate_total"] = sum(v for a in ("A1", "A2", "A3") for kk, v in out["attacks"][a].items() if kk in ("blocked_circuit", "blocked_gate"))
out["A3"]["unassignable_by_cause"] = dict(out["A3"]["unassignable_by_cause"])
print(json.dumps(out, indent=1))
