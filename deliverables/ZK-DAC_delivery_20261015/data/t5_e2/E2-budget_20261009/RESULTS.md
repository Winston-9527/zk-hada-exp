# E2 — budget races on real transactions — results (added 2026-10-12, audit #56: the directory had no RESULTS.md)
The pre-registration and results of E2 are part of v8: `../../t2_circuit_fix/zkdac_v8/PREREGISTRATION.md` (9ca27ec, section "E2") and
`../../t2_circuit_fix/zkdac_v8/RESULTS.md` (section "E2" and "Corrections 2026-10-12"). Data: `results/e2_anvil.json`. Run 1 failed at deployment
(`results/e2_anvil_run1_link_failed.stderr`, kept).

| race | submitted | accepted | accepted total | note |
|---|---|---|---|---|
| a1 v8: 10 notes of 10, 32 delegates (22 without a note) | 10 | 10 | 100 of 100 | only 10 could build a proof |
| a2 v8: 4 notes × 3 attempts, same note version | 12 | 4 | 40 | 1 per note; 8 BudgetSpent |
| revocation v8 | 2 | 1 | — | T1 StaleRevokedRoot after Δ = 30 s |
| a3 v7 gate | 64 | 64 | 640 | v7 has no quantity semantics (see the corrections) |

**Limits** (see the v8 corrections):
- one sender, fixed order;
- no unrevoked pre-built control for the freeze test;
- the research design's sweep axes were not run: h ∈ {10, 24}, fan-out ∈ {1, 32}, concurrency ∈ {1, 8, 32, 128}, Δ, and D = 8.
