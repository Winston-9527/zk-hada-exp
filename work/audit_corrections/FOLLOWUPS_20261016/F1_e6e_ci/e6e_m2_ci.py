# Audit follow-up F1 (../PREREGISTRATION.md): E6e M2 / M3 with the pre-registered 95 % cluster-bootstrap CI (2,000 resamples, seed 0, fixed scores).
# The test procedure is analyze_e6e.m2_test VERBATIM (its source is taken with inspect and only a CI block is inserted after p is computed);
# AUC and p must equal the committed m2.json / m3.json. usage (E6b venv): python e6e_m2_ci.py m2|m3 > m2_ci.json
import sys, os, json, inspect, importlib.util, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); E6E = os.path.normpath(os.path.join(HERE, "../../../t4_privacy/E6e-master-ancestor_20261014"))
spec = importlib.util.spec_from_file_location("e6e", os.path.join(E6E, "analyze_e6e.py")); A = importlib.util.module_from_spec(spec); spec.loader.exec_module(A)
def wauc(inv, ng, y, w):
    """weighted AUC with ties: inv = index of each row's score among the sorted unique scores (ng groups)"""
    wp = np.bincount(inv, weights=w * y, minlength=ng); wn = np.bincount(inv, weights=w * (1 - y), minlength=ng)
    below = np.concatenate([[0.0], np.cumsum(wn)[:-1]]); P, N = wp.sum(), wn.sum()
    return float((wp * (below + 0.5 * wn)).sum() / (P * N)) if P > 0 and N > 0 else None
CI_BLOCK = '''
        _rng = np.random.default_rng(0); _u, _inv = np.unique(s, return_inverse=True); _ng = len(_u); _yf = yte.astype(float); _boot = []
        if task.startswith("M2a"): _nu = len(u_names); _ct, _ch = u_code, h_code
        else: _gn = sorted(set(grp)); _gi = {g: k for k, g in enumerate(_gn)}; _nu = len(_gn); _gc = np.array([_gi[g] for g in grp])
        for _ in range(2000):
            _c = np.bincount(_rng.integers(0, _nu, _nu), minlength=_nu).astype(float)
            _w = _c[_ct] * _c[_ch] if task.startswith("M2a") else _c[_gc]
            _a = WAUC(_inv, _ng, _yf, _w)
            if _a is not None: _boot.append(_a)
        r["ci95_cluster"] = [float(np.percentile(_boot, 2.5)), float(np.percentile(_boot, 97.5))]; r["ci_resamples_used"] = len(_boot)
        r["ci_unit"] = ("master" if task.endswith("-M") else "parent") + (" (transcript unit x hypothesis unit)" if task.startswith("M2a") else " (subtree)")
'''
src = inspect.getsource(A.m2_test); anchor = "        out[nm] = r\n"
assert src.count(anchor) == 1; src = src.replace("def m2_test(", "def m2_test_ci(").replace(anchor, CI_BLOCK + anchor)
A.__dict__["WAUC"] = wauc; exec(compile(src, "m2_test_ci", "exec"), A.__dict__)
if __name__ == "__main__":
    verifier = sys.argv[1] == "m3"; A.m2_test = A.__dict__["m2_test_ci"]          # A.m2() calls m2_test by name: same variants, same family / Holm
    out = A.m2(5000, verifier=verifier)
    ref = json.load(open(os.path.join(E6E, "results", "m3.json" if verifier else "m2.json")))
    mism = [(v, k, f) for v, c in out["variants"].items() for k, x in c.items() for f in ("auc", "p") if abs(x[f] - ref["variants"][v][k][f]) > 1e-12]
    out["reproduction_check"] = {"cells": sum(len(c) for c in out["variants"].values()), "auc_p_mismatches": mism}
    print(json.dumps(out, indent=1))
