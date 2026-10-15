# T8 C5: compare the clean re-runs with the recorded results (classification of every T3 row, exhaustive-diff summary, every E6 row)
import json, sys
W, OUT = sys.argv[1], sys.argv[2]
ld = lambda p: json.load(open(p))
ok = True
def check(name, a, b):
    global ok
    same = a == b; ok &= same
    print(f"C5 {'ok' if same else 'FAIL'} {name}" + ("" if same else f"\n  recorded: {b}\n  rerun:    {a}"))
r, o = ld(f"{OUT}/attacks_v9.json"), ld(f"{W}/t3_attacks/v9/results/attacks_v9.json")
check("T3 v9 summary", r["summary"], o["summary"])
key = lambda x: (x.get("id"), x.get("variant", x.get("name", "")))
cls = lambda rows: sorted((str(key(x)), x.get("class", x.get("classification"))) for x in rows)
check("T3 v9 per-row classes", cls(r["rows"]), cls(o["rows"]))
r, o = ld(f"{OUT}/exhaustive_diff_v9_d4.json"), ld(f"{W}/t3_attacks/v9/results/exhaustive_diff_v9_d4.json")
check("exhaustive diff D=4", {k: r[k] for k in ("total", "agree", "statement_level_disagreements")}, {k: o[k] for k in ("total", "agree", "statement_level_disagreements")})
r, o = ld(f"{OUT}/e6_cases.json"), ld(f"{W}/t4_accountability/E6-threshold-opening_20261009/results/cases.json")
check("E6 totals", (r["total"], r["failed"]), (o["total"], o["failed"]))
check("E6 per-row pass/observed", [(x["id"], x["variant"], x["pass"], x["observed"]) for x in r["rows"]], [(x["id"], x["variant"], x["pass"], x["observed"]) for x in o["rows"]])
sys.exit(0 if ok else 1)
