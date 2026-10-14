# T8c — v9.2 addenda: results

Pre-registration: `PREREGISTRATION.md` (1566147, pushed before any item ran). Commands: `RUN_RECORD.md`.

## A — paired proving benchmark, v9.1 vs v9.2 (Mac M5 Pro)
`prove_bench.mjs 10` per version, in the order v9.1, v9.2, v9.1, v9.2. Seeds 1000–1009 per D for both versions. Window 12:26–12:32 UTC. Files: `results/bench_*.json`, `results/bench_log.txt`.

| D | v9.1 run 1 / run 2 (ms) | v9.2 run 1 / run 2 (ms) | v9.2 − v9.1, pair 1 / pair 2 | v9.1 run-to-run | v9.2 run-to-run | proofs verified |
|---|---|---|---|---|---|---|
| 1 | 793.1 / 828.7 | 813.5 / 808.3 | +20.4 / -20.4 | +35.6 | -5.2 | 4 × 10 / 10 |
| 2 | 1,449.5 / 1,491.2 | 1,478.3 / 1,525.5 | +28.8 / +34.3 | +41.7 | +47.2 | 4 × 10 / 10 |
| 3 | 2,398.6 / 2,443.8 | 2,459.8 / 2,450.6 | +61.2 / +6.8 | +45.2 | -9.2 | 4 × 10 / 10 |
| 4 | 2,684.9 / 2,740.9 | 2,724.5 / 2,768.9 | +39.6 / +28.0 | +56.0 | +44.4 | 4 × 10 / 10 |

- **v9.2 is not measurably slower than v9.1.**
  - Seven of the eight paired differences lie within the run-to-run variation of a single version, which is up to 56 ms here.
  - One is above its own depth's variation: D = 3, pair 1, +61 ms (2.5 %). Pair 2 at the same depth is +7 ms.
  - The mean over all eight pairs is +25 ms (≈ 1.5 %). With N = 10 per run this cannot be separated from zero. It is consistent with v9.2's single extra constraint (holder_sk ≠ 0).
- Every proof verifies: 160 / 160.
- **Absolute levels drift between sessions on the same Mac.**
  - v9.1 D = 2: 1,377 ms on 2026-10-13 (v9.1 RESULTS row 6), 1,450–1,491 ms here at 12:26 UTC.
  - v9.2 D = 2: 1,478–1,525 ms here; 1,381–1,395 ms in T5c I3's run at 13:10 UTC.
  - **Consequence for the paper:** absolute proving times should be quoted from one paired session, with the session stated. Comparisons should use paired designs.
- Conditions: no other experiment, build or smoke from this project ran on the Mac during the four runs. The `other_project_procs` count of 3 in the log is idle shells whose command lines matched the pattern.
  - A document-reading subagent (item B) and an ssh poll every 60 s were active. Both are light.

## B — timing-source audit of the claim ledger
`TIMING_SOURCE_AUDIT.md`: 148 macros (27 time, 1 rate, 12 gas, 13 size, 78 count, 17 other).
- **All 28 time and rate macros come from the Mac M5 Pro.** The machine is taken from each experiment's RUN_RECORD; no source file records it.
- **Flagged:**
  - T8b's wall times are RTX6000.
  - E2b's and T5c's t_p was labelled "median"; it is the v9.1 mean. Fixed by amendments E2b A1 and T5c A2, wording only.
  - The 0.3 s witness figure in T5c A1 comes from an RTX6000 smoke run and is used only as a rationale.
- **Stale relative to v9.2:**
  - The ledger's constraints are v9 values. The v9.2 values are 60,629 / 105,434 / 150,239 / 195,044.
  - The T3 counts are v9 values. The v9.2 values are 174 / 118 / 28 / 7 / 21 / 20 / 0.
  - Every time and gas macro has no v9.2 measurement in the ledger's sources. Item A and T5c I3 now give v9.2 proving times; E7d and T5c I3 give v9.2 gas.
  - The table lists each macro with its v9.2 counterpart or "no v9.2 measurement".
- **Party A's paper.tex was not edited.**

## C — v9.2 second-environment reproduction (RTX6000, worktree `zk-hada-exp-t8c`, nice 19)
Logs in `results/c/`.

| check | result |
|---|---|
| C1 compile c1..c4 | constraints 60,629 / 105,434 / 150,239 / 195,044; public inputs 17 / 18 / 19 / 20 ✓ |
| C2 r1cs + wasm sha256 vs the Mac build | **byte-identical** (8 / 8) ✓ |
| C3 released zkeys vs the env-2 r1cs + Hermez ptau | 4 / 4 "ZKey Ok"; exported VK = committed VK 4 / 4 ✓ |
| C4 forge, v9.2 suites (`V92*.t.sol`, committed fixtures) | 75 / 75 passed ✓ |
| C4 forge, full suite | 367 / 367 passed ✓ |
| C5 Mac proofs (40) verified on env 2 | 40 / 40 ✓ |
| C5 env-2 proofs (40, Xeon w7-3445) verified on the Mac | 40 / 40 ✓ |

v9.2 reproduces in the second environment exactly as v9.1 did (T8b). Wall times are not reported, because the steps ran at nice 19 next to E2b.
