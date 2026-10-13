# T8b C5: compare the second-environment re-runs with the recorded first-environment results (T3 v9.1 every row: class and failure location;
# exhaustive diff v9.1 D=4; every E6 row). Python 3.8+ stdlib.
import json, sys
W, OUT = sys.argv[1], sys.argv[2]
ld = lambda p: json.load(open(p))
ok = True
def check(name, a, b):
    global ok
    same = a == b; ok &= same
    print(f"C5 {'ok' if same else 'FAIL'} {name}" + ("" if same else f"\n  recorded: {b}\n  rerun:    {a}"))
smoke = open(f"{OUT}/v91_smoke.txt").read().splitlines()
check("v9.1 smoke D=1..4 accepted and opened", sum(("ACCEPT" in l and l.endswith("true")) for l in smoke), 4)
r, o = ld(f"{OUT}/attacks_v9_1.json"), ld(f"{W}/t3_attacks/v9_1/results/attacks_v9_1.json")
check("T3 v9.1 summary", r["summary"], o["summary"])
check("T3 v9.1 agree_reject_by_level", r["agree_reject_by_level"], o["agree_reject_by_level"])
row = lambda x: (str(x.get("id")), str(x.get("name")), x.get("D"), x.get("class"), str(x.get("circuit_fail")))
check("T3 v9.1 per-row (id, name, D, class, failure location)", sorted(map(row, r["rows"])), sorted(map(row, o["rows"])))
r, o = ld(f"{OUT}/exhaustive_diff_v9_1_d4.json"), ld(f"{W}/t3_attacks/v9_1/results/exhaustive_diff_v9_1_d4.json")
check("exhaustive diff v9.1 D=4", {k: r[k] for k in ("total", "agree", "statement_level_disagreements")}, {k: o[k] for k in ("total", "agree", "statement_level_disagreements")})
r, o = ld(f"{OUT}/e6_cases.json"), ld(f"{W}/t4_accountability/E6-threshold-opening_20261009/results/cases.json")
check("E6 totals", (r["total"], r["failed"]), (o["total"], o["failed"]))
check("E6 per-row pass/observed", [(x["id"], x["variant"], x["pass"], x["observed"]) for x in r["rows"]], [(x["id"], x["variant"], x["pass"], x["observed"]) for x in o["rows"]])
sys.exit(0 if ok else 1)
