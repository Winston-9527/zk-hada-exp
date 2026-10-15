# E7c — v9.1 proofs on the real gate: results

Pre-registration: `PREREGISTRATION.md` (de2bc37, pushed before any run).

Run in the second environment (T8b attempt 3, commit `f441c56`): host `enine`, Ubuntu 22.04 x86_64, forge 1.5.1, 2026-10-13 07:08 UTC.
- Every proof was generated there: `gen_fixtures_v91.mjs` took 34 s; `gen_batch_v91.mjs` took 488 s for 120 actions, 123 registrations, 123 mints, 1 revocation and 3 off-curve rows.
- The fixtures were copied back unchanged (`results/fixtures.sha256`).

Outputs:
- `results/forge_v91.txt`: forge output;
- `results/summary.json`: per-case counts, gas and prove times;
- `results/gen_*.stderr`.

## Verdict: every row as pre-registered; no false accept
Totals: 10 suites, **73 / 73 tests passed** in the second environment. The same fixtures also pass on the Mac, 73 / 73 (`results/forge_v91_on_mac_with_env2_fixtures.txt`).

| suite / case | per D = 1..4 | result |
|---|---|---|
| H history (V9.t.sol on v9.1) | — | 11 / 11: sequence, GB2, GB4, GB5, wrong mint amount, action-then-transfer, GB7 revocation freeze, replay, unregistered state, registerState, gas |
| P POLICY (V9Policy.t.sol on v9.1) | — | 34 / 34: the 23 V9Policy tests (the 20 POLICY rows of the v9 closure plus probes and A21c) and the 11 inherited H tests |
| B1 success | 30 | 120 / 120 accepted. Each one called the target once with the amount, marked the nullifier spent and inserted one note. Each emitted `Accountability(nf, ct)`, with ct equal to the proof's ciphertext words |
| B2 business revert | 30 | 120 / 120 rolled back completely (nullifier unspent, note root and target unchanged); the same proof was then accepted |
| B3 substitution (12 variants) | 30 | 1,440 / 1,440 rejected. The variants were: target, method, params, nonce, amount + qSpent, c1x, c2x, e[0], esign, chainId and another gate address (each → `InvalidProof`); amount only → `AmountMismatch` |
| B3 other valid TPK (same address and state) | 30 | 120 / 120 `InvalidProof` |
| B4 replay after success | 30 | 120 / 120 `BudgetSpent` |
| B5 clock skew 60 s | 10 | 40 / 40: accepted at NOW + 60; `BadClock` at NOW + 61 and at NOW − 1 |
| B5 note window 300 s | 10 | 40 / 40: accepted at the window; `StaleNoteRoot` at window + 1 |
| B5 issued window 300 s | 10 | 40 / 40: accepted at the window; `StaleIssuedRoot` at window + 1 |
| B5 revocation window Δ ∈ {0, 12, 60, 240} s, after a real revocation transaction | 10 per Δ | 160 / 160: accepted at Δ; `StaleRevokedRoot` at Δ + 1 |
| B6 another sender submits | 30 | 120 / 120 accepted. This is expected: the executor is not bound (a disclosed POLICY row, not a failure) |
| G7 off-curve key at hop j = 1, 2, 3 (D = 4) | — | v9.1 witness unsatisfiable at `BabyCheck L82` for every j; the v9 witness is satisfiable. Each v9 proof is **rejected by the v9.1 gate** (`InvalidProof`) and **accepted by a gate with the v9 verifiers and identical state**. Control: v9.1 proofs are rejected by the v9 gate (4 / 4) |

Registration accepted the off-curve master key at j = 1, so all three j reached the gate; none stopped at registration.

## Measurements (second environment; recorded, not criteria)
| D | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| execute gas, B1, excl. intrinsic and calldata: median / p95 (n = 30) | 483,725 / 603,395 | 491,047 / 610,717 | 498,369 / 618,039 | 505,691 / 625,361 |
| v9.1 prove time, fullProve, ms: median / p95 (n = 30) | 1,246 / 1,313 | 1,963 / 2,086 | 2,835 / 2,908 | 3,135 / 3,225 |

The gas spread within a depth is the same for every D (SD 49,516). It comes from the note-tree insertion order of the sequential B1 run. The D-to-D step is 7,322 gas, the same order as the T5 per-depth term.

## Deviations from the pre-registration
- **Fixture files.** The batch fixture is also written as one small JSON file per item (`foundry/test/fixtures_V91_batch/`). This was found in the local smoke run, before any second-environment run (`../../t8_paper/T8b-v91-repro_20261013/RUN_RECORD.md`): reading the whole fixture for every item ran out of EVM memory. The cases and expectations are unchanged.
- **Not done.** No second execution client, as pre-registered and disclosed.

## What this supports
On the real gate contract, v9.1 proofs generated on a second machine:
- execute exactly once;
- roll back completely on business failure;
- cannot be moved to another target, method, parameters, nonce, amount, chain, gate, committee key or ciphertext;
- respect all four time windows, including the revocation window Δ at the 0 / 1 / 5 / 20-epoch points of the research design.

The #53 off-curve key is shown end to end: a v9 gate accepts the off-curve proof and the v9.1 gate rejects it. Front-running by another sender remains possible, as disclosed.
