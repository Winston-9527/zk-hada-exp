#!/usr/bin/env python3
"""SMT liveness (issue #24): fraction of honest certificates that have NO exclusion witness in an SMTVerifier(RD) circuit.
Rule (calibrated in smt_depth_rule.json against the real RD=16 circuit, cross-checked 600/600 against circomlibjs on random data):
q is unprovable iff >= 2 revoked keys share >= RD-1 low bits with q. Keys are modelled as uniform random 248-bit values.
Analytic check: lambda = N / 2^(RD-1); P(stuck) = 1 - e^-lambda (1 + lambda)."""
import json, math, random, sys
random.seed(20261007)
Q = 100_000
out = []
for N in (10**3, 10**4, 10**5, 10**6):
    keys = [random.getrandbits(248) for _ in range(N)]
    queries = [random.getrandbits(248) for _ in range(Q)]
    for RD in (16, 20, 24, 32):
        m = (1 << (RD - 1)) - 1
        counts = {}
        for k in keys:
            b = k & m; counts[b] = counts.get(b, 0) + 1
        stuck = sum(1 for q in queries if counts.get(q & m, 0) >= 2)
        lam = N / 2 ** (RD - 1)
        out.append({"N": N, "RD": RD, "queries": Q, "stuck": stuck, "stuck_frac": stuck / Q,
                    "analytic": 1 - math.exp(-lam) * (1 + lam)})
        print(f"N={N:>8} RD={RD:>2}  stuck {stuck:>6}/{Q}  = {stuck/Q:.5f}   analytic {out[-1]['analytic']:.5f}", file=sys.stderr)
json.dump(out, open("results/smt_liveness_sim.json", "w"), indent=1)
