# T8c Item B: timing-source audit of the claim ledger

Pre-registration: `PREREGISTRATION.md`, "Item B". This is a document check only. Nothing was re-measured, built or run.

- **Object:** `../T8-chapter_20261010/CLAIM_LEDGER.md`, 148 macros. All paths below are relative to `work/` unless they are absolute.
- **Rule (pre-registered):**
  - Every time or rate that could enter the paper must come from the Mac M5 Pro. A time from another machine is flagged.
  - A logical-clock quantity is marked as such, because a parameter sets it.
- **No paper file was edited.** Party A's `paper.tex` and every other `.tex` file are unchanged.

## 1. Where the machine of each source run is recorded

No ledger source file has a `machine`, `host` or `hostname` field. A grep of the T5 and T6 `analysis.json` and of the T5b and T6b JSON files found none. The machine therefore comes from each experiment's RUN_RECORD.

| source experiment | machine | evidence (file:line) |
|---|---|---|
| T5 `t5_e2e/T5-e2e-scale_20261010` | Apple M5 Pro, 15 cores, 48 GiB | `RUN_RECORD.md:2`; `RESULTS.md:151` |
| T5b `t5_e2e/T5b-revocation-circuit_20261012` (`latency_p95_ci.json` bootstraps the T5 e4a rows) | Apple M5 Pro | `RUN_RECORD.md:1`; `latency_ci.mjs:10` reads T5's `e4a_steady.jsonl` |
| T6 `t6_baselines/T6-baselines_20261010` | Apple M5 Pro, 15 cores, 48 GiB | `RUN_RECORD.md:2`, `:6` |
| T6b `t6_baselines/T6b-reanalysis_20261012` (re-analysis of T6 `comp_bench.jsonl`) | data from the Mac (T6); the host of the re-analysis is not recorded | `RUN_RECORD.md:1` (node only, no machine); `analyze_t6b.mjs:25` reads T6 `comp_bench.jsonl` |
| v9.1 paired prove bench (the later counterpart cited below) | `"machine": "Apple M5 Pro x15"` | `t2_circuit_fix/zkdac_v9_1/results/prove_bench_paired_v9_v91.txt:3` (every block) |

## 2. Every ledger macro

Kinds:
- **size:** constraints, bytes and RSS.
- **count:** counts, k/n and public inputs.
- **other:** ratios, p-values, AUC and R².

Version is the circuit version of the source run. "v9.2 counterpart" gives the value and its evidence path, or "no v9.2 measurement".

Two v9.2 sources recur, so they are abbreviated:
- **[v92R]** = `t2_circuit_fix/zkdac_v9_2/RESULTS.md`;
- **[v92T3]** = `t3_attacks/v9_2/results/attacks_v9_2.json`.

### 2a. Circuit sizes, public inputs, mutations, attack suite (no time or rate)
| macro | value | kind | src ver. | v9.2 counterpart (value; evidence) |
|---|---|---|---|---|
| `\NConsVnineA` | 60,622 | size | v9 | 60,629; `zkdac_v9_2/results/compile.txt:1`, [v92R]:20 |
| `\NConsVnineB` | 105,424 | size | v9 | 105,434; `compile.txt:2` |
| `\NConsVnineC` | 150,226 | size | v9 | 150,239; `compile.txt:3` |
| `\NConsVnineD` | 195,028 | size | v9 | 195,044; `compile.txt:4` |
| `\NConsVnineOneA` | 60,628 | size | v9.1 | 60,629 (+1); `compile.txt:1` |
| `\NConsVnineOneB` | 105,433 | size | v9.1 | 105,434 (+1); `compile.txt:2` |
| `\NConsVnineOneC` | 150,238 | size | v9.1 | 150,239 (+1); `compile.txt:3` |
| `\NConsVnineOneD` | 195,043 | size | v9.1 | 195,044 (+1); `compile.txt:4` |
| `\NConsTransfer` | 84,008 | size | v8 | no v9.2 measurement. v9.2 does not change budget_transfer ([v92R]:31). T8b C1 re-confirmed 84,008 at the v9.1 freeze (`t8_paper/T8b-v91-repro_20261013/RESULTS.md:17`) |
| `\NConsReg` | 17,436 | size | pre-v9 | no v9.2 measurement. Registration is unchanged in v9.2 ([v92R]:35). T8b C1: 17,436 (`T8b RESULTS.md:17`) |
| `\NConsRevoke` | 51,815 | size | pre-v9 (E7) | no v9.2 measurement. Revocation is unchanged ([v92R]:35). T8b C1: 51,815 (`T8b RESULTS.md:17`) |
| `\NPubVnineD` | 20 | count | v9 | 20; `compile.txt:4`, [v92R]:20 |
| `\NPubVeightD` | 27 | count | v8 | not applicable (v8 comparator); no v9.2 measurement |
| `\NGasVnineFreshD` | 564,147 | gas | v9 | **no v9.2 measurement** of the same fresh-tree receipt. E7d gives B1 execute gas at D = 4 under a different accounting (excluding intrinsic gas and calldata, in a sequential note tree): median 505,691 (`t4_contracts/E7d-v92-gate_20261013/RESULTS.md:9`, `results/summary.json`). It is not comparable |
| `\NMutFieldA` / `\NMutSemA` / `\NMutUnexpA` | 199 / 37 / 0 | count | v9 | 199 / 37 / 0; `zkdac_v9_2/results/mutations_d1.json` (summary) |
| `\NMutFieldB` / `\NMutSemB` / `\NMutUnexpB` | 282 / 49 / 0 | count | v9 | 282 / 49 / 0; `mutations_d2.json` |
| `\NMutFieldC` / `\NMutSemC` / `\NMutUnexpC` | 408 / 62 / 0 | count | v9 | 408 / 62 / 0; `mutations_d3.json` |
| `\NMutFieldD` / `\NMutSemD` / `\NMutUnexpD` | 534 / 76 / 0 | count | v9 | 534 / 76 / 0; `mutations_d4.json` |
| `\NTthreeRows` | 170 | count | v9 | 174 (v9.1 and v9.2 add the 4 A24 rows); [v92T3] len(rows) |
| `\NTthreeAgRej` | 114 | count | v9 | 118; [v92T3] summary |
| `\NTthreeAgAcc` | 28 | count | v9 | 28; [v92T3] |
| `\NTthreeBwo` | 7 | count | v9 | 7; [v92T3] |
| `\NTthreeFa` | 21 | count | v9 | 21; [v92T3] |
| `\NTthreeFaPolicy` | 20 | count | v9 | 20; [v92T3] false_accepts with policy_dependent |
| `\NTthreeGap` | 0 | count | v9 | 0; [v92T3] completeness_gaps |
| `\NExTotal` / `\NExStmt` | 534 / 3 | count | v9 | 534 / 3; `t3_attacks/v9_2/results/exhaustive_diff_v9_2_d4.json` |
| `\NTthreeOneRows` / `\NTthreeOneAgRej` / `\NTthreeOneFa` | 174 / 118 / 21 | count | v9.1 | 174 / 118 / 21; [v92T3]; [v92R]:25 |
| `\NOffCurveRej` | 4 | count | v9.1 | 4 (all four A24 rows AGREE_REJECT); [v92T3] |
| `\NOffCurveVnineFa` | 4 | count | v9 ref. | 4; [v92T3] `reference_v9` (4 × FALSE_ACCEPT) |
| `\NOpenVnine` | 10/10 | count | v9 | 10/10 per D (single key and 3-of-5); `zkdac_v9_2/results/opening_check.json`, [v92R]:24 |

### 2b. E2, E3, E6, T5 counts and gas, T5b, privacy, Lean (no time or rate)
| macro(s) | value(s) | kind | src ver. | v9.2 counterpart |
|---|---|---|---|---|
| `\NEtwoVsevenAcc`, `\NEtwoVsevenSub`, `\NEtwoVeightAcc`, `\NEtwoVeightAtt`, `\NEtwoSameSub`, `\NEtwoSameOk` | 640, 64, 100, 32, 12, 4 | count | v7 / v8 gates (E2) | no v9.2 measurement. E2b, which targets v9.2, is only pre-registered |
| `\NEthreeRows`, `\NEthreeUnexp`, `\NEthreeAblation` | 598, 0, 14/14 | count | pre-v9 (E3) | no v9.2 measurement |
| `\NEsixRows`, `\NEsixFailed`, `\NEsixModeA` | 65, 0, 150/150 | count | pre-v9 (E6) | no v9.2 measurement of these rows. v9.2 re-checked opening only (`opening_check.json`) |
| `\NRevOneEdges`, `\NRevOneBlocked`, `\NRevOneFA`, `\NRevOneCD`, `\NRevOneStale`, `\NRevOneRebuilt` | 12, 84, 0, 0, 64, 32 | count | v9 (T5) | no v9.2 measurement ([v92R]:42 carries T5 over) |
| `\NRevTenEdges`, `\NRevTenBlocked`, `\NRevTenFA`, `\NRevTenCD`, `\NRevTenStale`, `\NRevTenRebuilt`, `\NRevSampleIn`, `\NRevSampleRe` | 120, 301, 0, 0, 64, 32, 64, 32 | count | v9 (T5) | no v9.2 measurement |
| `\NRevOneGas`, `\NRevTenGas` | 273,541, 273,538 | gas | T5 (revocation contract) | no v9.2 measurement. The revocation circuit and contract are unchanged by v9.2 ([v92R]:35) |
| `\NNSteady`, `\NNCold` | 30, 10 | count | v9 (T5) | no v9.2 measurement |
| `\NPeakRss` | 4.51 GiB | size (machine-dependent) | v9 (T5) | no v9.2 measurement. Mac M5 Pro (T5 `RUN_RECORD.md:2`) |
| `\NVerifierGas` | 315,215 | gas | v9 (T5) | no v9.2 measurement. The v9.2 verifiers are identical to v9.1 with digits masked, and v9.1 to v9 (`zkdac_v9_2/results/verifier_diff.txt`; [v92R]:27; `zkdac_v9_1/RESULTS.md:30`). Gas being unchanged is a structural argument, not a measurement |
| `\NEpochAcc`, `\NEpochOf`, `\NEpochBlocks` | 1,230, 1,230, 31 | count | v9 (T5) | no v9.2 measurement |
| `\NEpochPerBlock` | 39.7 | other (txs per block) | v9 (T5) | no v9.2 measurement |
| `\NGasWorldD` | 743,211 | gas | v9 (T5) | no v9.2 measurement (E7d B1 uses a different accounting, see `\NGasVnineFreshD`) |
| `\NNoteLeaves` | 3,830 | count | v9 (T5) | no v9.2 measurement |
| `\NLawBase`, `\NLawPop`, `\NLawD` | 529,576, 27,089, 7,763 | gas (fit) | v9 (T5) | no v9.2 measurement. E7c/E7d report a D-to-D step of 7,322 (`t4_contracts/E7c-v91-gate_20261013/RESULTS.md:41`; E7d equal) under a different accounting |
| `\NLawRsq` | 0.999997 | other | v9 (T5) | no v9.2 measurement |
| `\NWorldAgents`, `\NWorldDfour` | 1,230, 1,024 | count (design) | T5 world | not version-dependent |
| `\NBlockedAgents`, `\NBlockedRejPred`, `\NBlockedRejOwn`, `\NBlockedFA`, `\NFreeControls` | 301, 301, 301, 0, 64 | count | v9 and v9.1 (T5b) | no v9.2 measurement |
| `\NUcanBytesD` | 1,853 | size | baseline (T6) | not applicable (baseline) |
| `\NBzeroMedA..D` | 115,215 / 153,062 / 190,883 / 228,705 | gas | plaintext baseline (T6) | not applicable (baseline, version-independent) |
| `\NRatioFreshA..D`, `\NRatioWorldA..D` | 4.66 / 3.56 / 2.9 / 2.45; 5.96 / 4.61 / 3.81 / 3.25 | other (gas ratio vs v9) | v9 | no v9.2 measurement |
| `\NRatioFreshMax`, `\NRatioWorldMax` | 6.70, 8.63 | other (gas ratio) | v9 (T6b) | no v9.2 measurement |
| `\NCompressHolmB` | 0.031 | other (p-value) | v8→v9 (T6b) | no v9.2 measurement |
| `\NLinkCells`, `\NLinkDetected`, `\NLinkPerms`, `\NCtrlCells`, `\NCtrlDetected` | 18, 0, 1000, 18, 18 | count | v9 (E6b2) | no v9.2 re-run of this analysis. E6d and E6e ran on v9.2 (`t4_privacy/E6d-worlds-weakleak_20261013/RESULTS.md:8`, `E6e-master-ancestor_20261014/RESULTS.md:7`), but with different designs, so they are not counterparts |
| `\NLinkMaxCiLo`, `\NCtrlHolm`, `\NLinkNullQninetynine`, `\NCthreeMinP` | 0.471, 0.006, 0.70, 0.029 | other | v9 (E6b2) | as above |
| `\NDetTranscripts`, `\NDetShared`, `\NDetDiff` | 512, 0, 0 | count | v9 (E6b) | as above |
| `\NLeanStmts`, `\NLeanSorry` | 6, 0 | count | model level (T7b) | not circuit-dependent; no v9.2 re-check |

### 2c. Time and rate macros (machine check)
Every time and rate macro is sourced from v9 or earlier. None has a v9.2 measurement: no v9.2 proving benchmark exists in `zkdac_v9_2/results/`, and [v92R] contains no times.

| macro | value | kind | src ver. | machine (evidence) | v9.2 counterpart |
|---|---|---|---|---|---|
| `\NLocalA..D` | 0.92 / 1.55 / 2.41 / 2.74 s | time | v9 (T5 e4a) | Mac M5 Pro (T5 `RUN_RECORD.md:2`) | no v9.2 measurement |
| `\NProveA..D` | 0.75 / 1.35 / 2.18 / 2.46 s | time | v9 (T5) | Mac M5 Pro (same) | no v9.2 measurement. The nearest later measurement is the standalone v9.1 prove bench on the Mac, mean ms run 1 / run 2: 787 / 787, 1,377 / 1,377, 2,240 / 2,311, 2,585 / 2,543 (`zkdac_v9_1/RESULTS.md:29`; `results/prove_bench_paired_v9_v91.txt`). Its harness differs from T5 S4_prove |
| `\NColdDeltaA..D` | 100 / 107 / 137 / 139 ms | time | v9 (T5) | Mac M5 Pro | no v9.2 measurement |
| `\NSlopeHop`, `\NSlopeLo`, `\NSlopeHi` | 633, 627, 641 ms per hop | time (slope) | v9 (T5) | Mac M5 Pro | no v9.2 measurement |
| `\NPninetyfiveSteady`, `\NPninetyfiveCold` | 2.86, 2.94 s | time | v9 (T5) | Mac M5 Pro | no v9.2 measurement |
| `\NProofsPerMin` | 23.1 | rate | v9 (T5) | Mac M5 Pro (T5 `RUN_RECORD.md:2`; `RESULTS.md:98`) | no v9.2 measurement |
| `\NPninetyfiveLo`, `\NPninetyfiveHi` | 2.75, 3.01 s | time | v9 (T5 data, T5b bootstrap) | Mac M5 Pro (T5b `RUN_RECORD.md:1`, data from T5) | no v9.2 measurement |
| `\NUcanVerifyD` | 0.184 ms | time | baseline (T6 B1) | Mac M5 Pro (T6 `RUN_RECORD.md:2`, `:6`) | not applicable (baseline) |
| `\NDacShowA`, `\NDacVerifyA` | 2.73, 16.2 ms | time | baseline (T6 B2) | Mac M5 Pro | not applicable (baseline) |
| `\NZkcMono` | 260 ms | time | baseline (T6 B3) | Mac M5 Pro | not applicable (baseline) |
| `\NAcctCostD`, `\NBudgetCostD`, `\NAcctCostC` | 84, 63, 620 ms | time (paired diff) | v6→v7, v7→v8 (T6 components) | Mac M5 Pro | no v9.2 measurement |
| `\NCompressDiffB` | −7 ms | time (paired diff) | v8→v9 (T6b on T6 data) | Mac M5 Pro for the data; the re-analysis host is not recorded (T6b `RUN_RECORD.md:1`) | no v9.2 measurement |

**Result:** all 28 time and rate macros (27 time, 1 rate) come from Mac M5 Pro runs. No ledger time or rate comes from another machine or from an unknown machine. The single caveat is T6b, whose RUN_RECORD names no host. That run only re-analyses Mac data, so it does not affect the measured value.

## 3. Timing numbers in the newer experiments (not in the ledger)
| source | number | machine | measured or parameter |
|---|---|---|---|
| T7c `t7_proofs/T7c-proof-mapping_20261013/RESULTS.md:52` | Δ = 2 ticks; 1 tick = 1,000 s; revocation window 2,500 s | none (anvil timestamps) | **logical-clock parameter** |
| T7c `RESULTS.md:57-58`; `RUN_RECORD.md:19-20` | R1 mock wall time 469 s; R1 real wall time 694 s, run in parallel | Mac M5 Pro (`RESULTS.md:5`, `RUN_RECORD.md:1`) | measured wall clock (harness duration, not a result claim) |
| T7c `RUN_RECORD.md:9`, `:12` | x1_imt 1 min 58 s; x3_x5 15 s | Mac M5 Pro | measured wall clock |
| v9.2 [v92R] | **no timing number**. The only time is in `RUN_RECORD.md:8` (setup "~3 min") | Mac M5 Pro (`RUN_RECORD.md:1`, [v92R]:2) | measured wall clock (approximate) |
| E6d `RESULTS.md:61` (prereg `PREREGISTRATION.md:73`, `:118`) | W2 timing offset +30 s under a round jitter of U{0..59} s | none (synthetic timestamps) | **parameter** of the world (positive control) |
| E6d `RESULTS.md:116`; `RUN_RECORD.md:30-35` | generation ≈ 5 h (14:17–19:17 UTC), 8 processes; analyses 19:18–19:33 and 19:35–20:17 | Mac M5 Pro (`RESULTS.md:9`, `RUN_RECORD.md:4`) | measured wall clock |
| E6e `RESULTS.md:34` | W2 timing +30 s | none | **parameter** |
| E6e `RUN_RECORD.md:30-37` | witnesses 06:37–06:45; proofs (8 shards) 06:45–08:50; analyses 08:51–09:02 UTC | Mac M5 Pro (`RESULTS.md:7`, `RUN_RECORD.md:4`) | measured wall clock |
| T8b `RESULTS.md:7`, `:26` | run 06:45–07:30 UTC; wall time 45 min clone→C6 (downloads 16 min, C5 re-runs 10 min) | **RTX6000** (host `enine`, Xeon w7-3445, `RESULTS.md:7-8`) | measured wall clock. **Flag:** not from the Mac. T8b states timings are not claims (`RESULTS.md:43`) |
| T8b `RUN_RECORD.md:29` | E7c fixtures 34 s + 488 s; E6c fixtures 449 s, cases 3,468 s | **RTX6000** | measured wall clock. **Flag:** not from the Mac |
| T8b `RUN_RECORD.md:6`, `:10` | E7c smoke N = 30: 8 min 42 s; E6c smoke ≈ 1 h | Mac M5 Pro | measured wall clock (smoke, not evidence) |
| E2b prereg `/Users/siyuan/Developer/zk-hada-exp-e2b/.../PREREGISTRATION.md:11-14` | logical clock; t_p = 1.377 s | run on RTX6000; t_p is taken from the Mac | **logical-clock parameter**. The wall clock is recorded but not reported (`:14`) |
| E2b prereg `:19-20`, `:44` | noteWindow 600 s; clockSkew 3,600 s; block interval b ∈ {1 s, 2 s} | none | **parameters** |
| E2b prereg `:62-63` | latency (p50 and p95) and effective parallelism (actions per second) | none | **logical-clock outputs**. They are set by t_p and b, not by the RTX6000's speed |
| T5c prereg `/Users/siyuan/Developer/zk-hada-exp-t5c/.../PREREGISTRATION.md:16-18` | 2 s per block; epoch = 15 blocks = 30 s; t_p = 0.787 / 1.377 / 2.240 / 2.585 s | run on RTX6000; t_p is taken from the Mac | **logical-clock parameters** |
| T5c prereg `:28`, `:33`, `:35`, `:83` | note window 600 s; issued-root window 300 s; Δ ∈ {0, 30, 150, 600} s; run 900 s; root churn about every 1.25 s | none | **parameters**, and a value derived from them |
| T5c prereg `:102` | "about 0.3 s per real witness", from the smoke run on a loaded server | **RTX6000** | measured during a smoke run. It is used only as a rationale for a design choice. **Flag:** it must not enter the paper as a timing |

**Provenance check of t_p** (`t2_circuit_fix/zkdac_v9_1/results/prove_bench_paired_v9_v91.txt`, `"machine": "Apple M5 Pro x15"`):
- The v9.1 values in `zkdac_v9_1/RESULTS.md:29` are **means**, not medians:
  - run 1 (block 16:41:32): mean 786.6 / 1,376.9 / 2,239.6 / 2,584.5, median 770.4 / 1,376.9 / 2,233.6 / 2,572.5;
  - run 2 (block 16:44:41): mean 786.6 / 1,377.1 / 2,311.2 / 2,543.3, median 771.3 / 1,375 / 2,328.1 / 2,550.1.
- **E2b:** t_p = 1.377 s is the rounded run-1 or run-2 mean. It is labeled "median ... run 2", but the run-2 median is 1.375 s.
  - **Flag:** labeling only, 2 ms.
- **T5c:** 0.787 / 1.377 / 2.240 / 2.585 s are the **run-1 means**, labeled "medians ... run 2".
  - The run-2 means are 0.787 / 1.377 / 2.311 / 2.543 s.
  - At D = 3 and D = 4, the cited run differs from the values used by +71 ms and −42 ms.
  - **Flag:** a labeling inconsistency. The parameters are fixed in the pre-registration, so this concerns how they are described, not the measurement.
- Both are **v9.1** times used for a **v9.2** run. E2b says so (`:12`, "v9.2 adds one constraint"); T5c does not. No v9.2 proving-time measurement exists.

## 4. Summary
- **Counts per kind (148 macros):**
  - time 27: every row of 2c except `\NProofsPerMin`;
  - rate 1: `\NProofsPerMin`;
  - gas 12: fresh, world, 2 revocation, verifier, 3 law coefficients, 4 B0 medians;
  - size 13: 11 constraint counts, `\NUcanBytesD`, `\NPeakRss`;
  - count 78: includes public inputs, k/n values and `\NLinkPerms`;
  - other 17: 10 gas ratios, `\NCompressHolmB`, `\NLawRsq`, `\NEpochPerBlock`, and 4 E6b2 statistics.
- **Flagged items:**
  1. Ledger: none. All 28 time and rate macros come from Mac M5 Pro runs (T5, T5b and T6 RUN_RECORDs).
     - Minor: the T6b RUN_RECORD (`\NCompressDiffB`, `\NCompressHolmB`) names no host. It only re-analyses the T6 Mac data.
  2. T8b timings (45 min, 16 min, 10 min; `RUN_RECORD.md:29` fixture and case times) are from **RTX6000**. They must stay out of the paper, as T8b itself states.
  3. T5c prereg `:102`: "≈ 0.3 s per real witness" was measured on a loaded **RTX6000**. It is a rationale only and must not enter the paper.
  4. The t_p provenance labels in E2b and T5c are inaccurate.
     - They say "median, run 2", but the values are means. For T5c at D = 3 and 4, they are the run-1 means.
     - They are v9.1 times applied to v9.2.
     - E2b and T5c outputs in seconds are **logical-clock quantities**, not measurements.
- **Macros stale relative to v9.2:** every macro is sourced from v9.1 or earlier. The ones with a v9.2 counterpart:
  - constraints: `\NConsVnineA..D` and `\NConsVnineOneA..D` become 60,629 / 105,434 / 150,239 / 195,044 (`zkdac_v9_2/results/compile.txt`);
  - `\NPubVnineD`: 20, unchanged;
  - `\NMut*A..D`: identical, 199/37/0, 282/49/0, 408/62/0 and 534/76/0;
  - T3 v9 macros: v9.2 gives 174 / 118 / 28 / 7 / 21 / 20 / 0, and the exhaustive diff 534 / 3, against v9's 170 / 114;
  - T3 v9.1 and off-curve macros: identical in v9.2 (174 / 118 / 21; 4; 4);
  - `\NOpenVnine`: 10/10 (`opening_check.json`).
- **Stale without a v9.2 measurement:**
  - all 28 time and rate macros;
  - all gas macros: verifier gas is unchanged only by the structural verifier diff, and the E7d execute gas uses a different accounting;
  - the E2, E3, E6, T5, T5b, T6/T6b and E6b/E6b2 counts and statistics;
  - budget_transfer, registration and revocation constraints: unchanged by design, and re-confirmed at v9.1 by T8b.
- **No paper file was edited.** `paper.tex` and every other `.tex` file are unchanged. Nothing was committed or pushed.
