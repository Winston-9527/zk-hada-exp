# T5c — interactions (WP8): results for I1 (revocation rate × window Δ) and I3 (depth D × accountability)

- **Pre-registrations:**
  - `PREREGISTRATION.md` for I1: 5027ca0. Amendments A1 1c1950f, A2 d880168, A3 eea0498.
  - `PREREGISTRATION_I3.md` for I3: 036ea8b.
- **I2** (fan-out × concurrency) is not done yet; it will be pre-registered separately.
- **Machine:** Apple M5 Pro. I1 moved from RTX6000 by amendment A3.
- **Commands:** `RUN_RECORD.md`.

## I1 — revocation rate × Δ on the 1,230-agent T5 tree (36 runs, all exit 0)
Logical clock: 2 s blocks and 30 s epochs, 30 epochs per run. t_p = the Mac v9.1 means per D.
- The gate, revocation and registry code is real. The proof verifiers are accept-all.
- Correctness is checked off-chain: JS witness construction for every attempt, plus real witnesses and proofs on samples.

**Hard checks (`results/stats.json` "hard"):**
- **H1:** accepted actions of a revoked branch after t_e + Δ = **0** in all 36 runs.
- **H2:** non-descendant agents strictly denied = **0** in all 36 runs.
- Fresh-root witnesses constructible by revoked descendants: **0**.
- Note-root mirror mismatches: **0**.

**Checks on samples (all runs):**
- (b) real witnesses for adversarial old-root attempts: 100 % satisfiable.
- (c) real witnesses for honest attempts: 30 / 30 satisfiable in every run.
- (d) full Groth16 proofs of accepted honest actions: 10 / 10 valid, with public signals equal to the submitted ones, in every run.
- (e) revoke_transition witnesses: 120 / 120 (r = 10 %) and 12 / 12 (r = 1 %) satisfiable.
- **Deviation:** check (b) reached fewer than the pre-registered 30 samples in runs with few adversarial attempts: 7–28 per run, and 0 at r = 0. The sampling probability of 0.05 was too low. Every sampled witness was satisfiable.

**Availability of non-descendant agents and exposure** (mean ± SD over 3 seeds; `results/stats.json` "cells"):

| r | Δ | transient denials | attempts / accepted action | mean exposure per revoked edge (s) | max exposure (s) |
|---|---|---|---|---|---|
| 10 % | 0 | **5.99 % ± 1.27** | **1.148 ± 0.017** | 0 (no acceptance after revocation) | — |
| 10 % | 30 s | 0 | 1.000 | 14.1 ± 0.8 | 30 |
| 10 % | 150 s | 0 | 1.000 | 133.1 ± 1.1 | 150 |
| 10 % | 600 s | 0 | 1.000 | 580.5 ± 2.7 | 600 |
| 1 % | 0 | 0 | **1.031 ± 0.005** | 0 | — |
| 1 % | 30 s | 0 | 1.000 | 17.4 ± 2.6 | 28–30 |
| 1 % | 150 s | 0 | 1.000 | 137.4 ± 1.5 | 148–150 |
| 1 % | 600 s | 0 | 1.000 | 585.1 ± 5.5 | 598–600 |
| 0 % | any | 0 | 1.000 | — | — |

- Every rejection was **StaleRevokedRoot**.
  - At r = 10 % and Δ = 0, non-descendants were rejected 13,133 times in seed 0.
  - Δ ≥ 30 s gave **no rejection at all**: the window absorbs every root change that happens between observation and inclusion (t_p ≤ 2.6 s plus one 2 s block).
- An adversarial revoked descendant that replays its last valid root acts until **exactly t_e + Δ**. Max exposure equals Δ in every cell; the mean is lower because descendants act once per epoch.

**Interaction (Freedman–Lane, 10,000 permutations, Holm over 3 responses; `results/stats.json`):**

| response | interaction share of total SS | p | Holm p |
|---|---|---|---|
| transient denial rate | 0.53 | 1e−4 | **3e−4** |
| attempts per accepted action | 0.45 | 1e−4 | **3e−4** |
| mean exposure (r > 0) | 1.5e−5 | 0.28 | 0.28 |

**Reading.**
- Δ trades exposure for availability, and the availability cost exists only when Δ is shorter than the proving-plus-inclusion time:
  - at Δ = 0 it grows with the revocation rate (r = 10 %: 6 % of actions denied after 4 attempts; 15 % more attempts);
  - at Δ ≥ 30 s it vanishes, while exposure equals Δ independently of r.
- Hence the interaction on availability and the absence of an interaction on exposure.
- Any Δ ≥ t_p + one block (here 30 s) removes the availability cost and bounds exposure by Δ. This is the window the deployment chooses.

## I3 — depth D × accountability on/off (cost decomposition; security ablation)
- The variant `zkdac_v9_2_noacc` is v9.2 minus the accountability inputs and component; the diff shows only these removals.
- The gate variant `ZkDacGateV9NoAcc` is test-only.
- **Without accountability, R6 (opening) is lost.** These numbers state what accountability costs; they are not a faster competitor.

| D | constraints on / off (Δ, share) | public inputs on / off | prove ms on / off (Mac, mean of 2 paired runs) | verifier tx gas Δ | execute gas on / off (Δ, share) | calldata bytes on / off |
|---|---|---|---|---|---|---|
| 1 | 60,629 / 51,401 (+9,228, 15.2 %) | 17 / 8 | 780.9 / 720.6 (+60, 7.7 %) | +64,431 | 588,842 / 515,969 (+72,873, 12.4 %) | 1,060 / 804 |
| 2 | 105,434 / 95,079 (+10,355, 9.8 %) | 18 / 8 | 1,388.4 / 1,326.6 (+62, 4.5 %) | +71,578 | 623,684 / 543,065 (+80,619, 12.9 %) | 1,092 / 804 |
| 3 | 150,239 / 138,757 (+11,482, 7.6 %) | 19 / 8 | 2,294.7 / 2,199.1 (+96, 4.2 %) | +78,737 | 631,436 / 543,065 (+88,371, 14.0 %) | 1,124 / 804 |
| 4 | 195,044 / 182,435 (+12,609, 6.5 %) | 20 / 8 | 2,575.1 / 2,501.3 (+74, 2.9 %) | +85,944 | 666,266 / 570,117 (+96,149, 14.4 %) | 1,156 / 804 |

Notes:
- **Sources.**
  - Proving: `results/i3/bench_*` (order on, off, on, off; seeds 1000–1009; all proofs 10 / 10). The paired differences are consistent across the two runs: +60 / +61, +58 / +66, +107 / +84, +83 / +65 ms.
  - Gas: `results/i3/gas.json`. The note tree was prefilled identically for both gates, the change-note indices were 104–107 for both, and the shared target was warmed.
  - Attempt 1 (`results/i3/attempt1_cold_target/`) charged the target's first-call storage writes to the first execute. It is kept.
- **Accountability costs grow by about 7.7k gas per hop**, from one more ciphertext word and public input. The prover cost is 3–8 %.
- **Integrity of the ablation** (`results/i3/mutation_smoke.json`): for D = 1..4, honest witnesses are satisfiable. holder_sk = 0, a wrong certificate and a wrong note root are unsatisfiable at the same templates as in v9.2, with line numbers shifted by exactly the 13 removed lines.
