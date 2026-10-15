# T8d comparison (PREREGISTRATION.md). R1: env2 T3 outputs vs the committed first-environment results, row by row. R3: Mac vs env2 scaled-T5 judgments.
# usage: python3 compare.py > results/compare.json
import json, os, glob
H = os.path.dirname(os.path.abspath(__file__)); T3 = os.path.join(H, "../../t3_attacks"); out = {"R1": {}, "R3": None}
KEY = ("id", "name", "D", "circuit", "oracle", "class", "policy_dependent", "valid_witness_exists", "circuit_fail")
for v in ("v9_1", "v9_2"):
    a = json.load(open(f"{T3}/{v}/results/attacks_{v}.json")); p = f"{H}/results/env2/t3/attacks_{v}.json"
    if not os.path.exists(p): out["R1"][v] = "missing"; continue
    b = json.load(open(p)); ra, rb = a["rows"], b["rows"]           # rows compared in order: ids repeat across D variants
    diffs = [{"row": n, "id": ra[n].get("id"), "field": k, "env1": ra[n].get(k), "env2": rb[n].get(k) if n < len(rb) else None} for n in range(len(ra)) for k in KEY if n >= len(rb) or rb[n].get(k) != ra[n].get(k)]
    ea = json.load(open(f"{T3}/{v}/results/exhaustive_diff_{v}_d4.json")); eb = json.load(open(f"{H}/results/env2/t3/exhaustive_diff_{v}_d4.json"))
    out["R1"][v] = {"rows_env1": len(ra), "rows_env2": len(rb), "row_field_differences": diffs, "summary_equal": a["summary"] == b["summary"], "summary": b["summary"],
                    "exhaustive_equal": {k: ea[k] == eb[k] for k in ("total", "agree", "disagreements_by_field", "statement_level_disagreements")}, "exhaustive_env2": {k: eb[k] for k in ("total", "agree", "statement_level_disagreements")}}
def t5(m):
    base = f"{H}/results/{m}/t5s/results"
    if not os.path.exists(f"{base}/e4b_revoke_10.json"): return None
    J = lambda n: json.load(open(f"{base}/{n}.json")); wb = J("world_build"); ep = J("e4b_epoch1"); r1 = J("e4b_revoke_1"); r10 = J("e4b_revoke_10")
    steady = [json.loads(l) for l in open(f"{base}/e4a_steady.jsonl")]
    strip = lambda d, drop: {k: v for k, v in d.items() if not any(x in k for x in drop)}
    TIME = ("ms", "wall", "time", "per_minute", "seconds", "_s", "date", "client")
    return {"world_build": strip(wb, TIME), "steady": sorted((r.get("agent"), r.get("D"), r.get("status"), r.get("reason"), r.get("gasUsed")) for r in steady),
            "epoch1": strip(ep, TIME), "revoke_1": strip(r1, TIME), "revoke_10": strip(r10, TIME)}
A, B = t5("mac"), t5("env2")
if A and B:
    def diff(x, y, path=""):
        if isinstance(x, dict) and isinstance(y, dict): return [d for k in sorted(set(x) | set(y)) for d in diff(x.get(k), y.get(k), f"{path}.{k}")]
        if isinstance(x, list) and isinstance(y, list) and len(x) == len(y) and all(isinstance(e, (dict, list)) for e in x): return [d for i, (p, q) in enumerate(zip(x, y)) for d in diff(p, q, f"{path}[{i}]")]
        return [] if x == y else [{"path": path, "mac": str(x)[:200], "env2": str(y)[:200]}]
    d = diff(A, B); out["R3"] = {"differences": d[:200], "n_differences": len(d), "compared_sections": list(A)}
print(json.dumps(out, indent=1))
