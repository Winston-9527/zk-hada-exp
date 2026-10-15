# E7c summary: per suite pass/fail from the forge output, per (case, D) counts from the "E7C" log lines, B1 gas (median, p95, mean, sd), G7 rows.
import json, re, sys, statistics as st
txt = open(sys.argv[1]).read(); fx = json.load(open(sys.argv[2]))
suites = re.findall(r"Ran \d+ tests? for (\S+)\n(.*?)Suite result: (\w+)\. (\d+) passed; (\d+) failed", txt, re.S)
tests = re.findall(r"\[(PASS|FAIL)[^\]]*\] (\w+)\(\)", txt)
cnt, gas = {}, {}
for case, D, i, rest in re.findall(r"E7C (\S+) D=(\d) i=(\d+) (.*)", txt):
    cnt[(case, int(D))] = cnt.get((case, int(D)), 0) + 1
    m = re.search(r"gas=(\d+)", rest)
    if m: gas.setdefault(int(D), []).append(int(m.group(1)))
q = lambda v, p: sorted(v)[min(len(v) - 1, int(p * len(v)))]
out = {"suites": [{"suite": s, "result": r, "passed": int(p), "failed": int(f)} for s, _, r, p, f in suites],
       "tests_failed": [t for st_, t in tests if st_ == "FAIL"], "tests_total": len(tests),
       "case_counts": {f"{c} D={d}": n for (c, d), n in sorted(cnt.items())},
       "B1_gas_execute_excl_intrinsic_calldata": {f"D={d}": {"n": len(v), "median": q(v, .5), "p95": q(v, .95), "mean": round(st.mean(v)), "sd": round(st.stdev(v)) if len(v) > 1 else 0, "min": min(v), "max": max(v)} for d, v in sorted(gas.items())},
       "prove_ms_second_env": {f"D={d}": {"median": q(v, .5), "p95": q(v, .95)} for d in (1, 2, 3, 4) for v in [[a["proveMs"] for a in fx["actions"] if a["D"] == d]] if v},
       "offcurve_witness": [{"j": o["j"], "v9.1": o.get("v91"), "v9": o.get("v9"), "stage": o.get("stage"), "v9_proof": "a" in o} for o in fx["offcurve"]],
       "n_per_D": fx["nPerD"]}
print(json.dumps(out, indent=1))
