# E6d — multiple independent privacy worlds + weak-leak positive controls (WP10): results

- **Pre-registration:** `PREREGISTRATION.md`.
  - 030d79b: pushed before any world was built.
  - Amendment A1, 2f2a220 / 50056e4: before any analysis of real transcripts.
  - Amendment A2, 15f8eb0: **post hoc**, after the primary results.
- **Commands:** `RUN_RECORD.md`.
- **Object:** v9.2, branch `v9-2-f2` (f1b0d2c).
- **Run:** locally on an Apple M5 Pro.

**Scope.** This is an empirical result, not a proof of anonymity. It covers these attacks, these features and the measured power. It does not cover master linkage or corrupted ancestors (WP11), network, gas-payer or timing side channels, or revocation entries (pre-registration, "Not covered").

## Corpus
- 8 worlds, each with K = 64 agents and 16 rounds, so 1,024 transcripts per world and **8,192** in total.
- Every transcript carries a real v9.2 Groth16 proof.
- **8,192 / 8,192** proofs verify with the committed v9.2 VK (`results/verify.json`).

| world | D | parents × children | above the parents |
|---|---|---|---|
| w1 / w2 | 2 | 8×8 / 16×4 | masters |
| w3 / w4 / w5 | 3 | 8×8 / 16×4 / 8×8 | 2×4 / 4×4 / 8×1 |
| w6 / w7 / w8 | 4 | 8×8 / 16×4 / 8×8 | 2×2×2 / 2×4×2 / 4×1×2 |

## Deterministic tests (D1 / D2)
All counts are 0 in all 8 worlds (`results/deterministic.json`):
- D1 covers the words that must never repeat: proof, ciphertext, budget_nf and cm_change (18 / 19 / 20 positions for D = 2 / 3 / 4). No value is shared across transcripts.
- D2: no equal ciphertext difference, and no budget_nf equal to any cm_change.
- Distinct budget_nf: 1,024 / 1,024 in every world.

Feature implementation versus E6b `pair_features`: 0 / 2,400 mismatches (`results/feature_check.json`).

## Primary result: the A1 pipeline, as pre-registered (`results/classifiers.json`, B = 1,000)
**Decision on fresh transcripts: NO LINK in all 6 cells** (Holm-adjusted combined p = 1.0 in every cell; Fisher p from 0.31 to 0.98).

| cell | C1 logreg | C1 rf | C1 knn | C2 logreg | C2 rf | C2 knn |
|---|---|---|---|---|---|---|
| mean test AUC over 8 worlds | 0.501 | 0.496 | 0.494 | 0.501 | 0.500 | 0.503 |
| t 95 % CI | [0.494, 0.508] | [0.491, 0.501] | [0.488, 0.499] | [0.492, 0.509] | [0.490, 0.511] | [0.500, 0.507] |

- Across the 48 per-world tests, AUC ranges from 0.479 to 0.519, and the smallest p is 0.029 (w8 C2 rf). No test has p < 0.01.
- The null 99 % quantiles lie between 0.520 and 0.527.
- C1 knn has an upper CI bound below 0.5. That is below chance, not a leak; the combined p is 0.98.

**Positive controls.** Each cell shows the mean AUC · the number of worlds with p < 0.01. **Bold** = detected (Holm-adjusted combined p < 0.01).

| variant | C1 logreg | C1 rf | C1 knn | C2 logreg | C2 rf | C2 knn |
|---|---|---|---|---|---|---|
| W1 ε=0 | 0.507 · 0/8 | 0.511 · 1/8 | 0.507 · 0/8 | 0.506 · 1/8 | **0.522 · 4/8** | **0.520 · 4/8** |
| W1 ε≥0.30 | ≤ 0.509, 0/8 in every cell |||||||
| W2 ε=0 | **0.557 · 8/8** | **0.565 · 8/8** | 0.507 · 0/8 | **0.567 · 8/8** | **0.581 · 8/8** | **0.514 · 1/8** |
| W2 ε≥0.30 | ≤ 0.505, 0/8 in every cell |||||||
| W3 ε=0 | **0.759 · 8/8** | **0.760 · 8/8** | **0.753 · 8/8** | **0.761 · 8/8** | **0.762 · 8/8** | **0.761 · 8/8** |
| W3 ε=0.30 | **0.511 · 1/8** | **0.521 · 2/8** | 0.506 · 0/8 | **0.516 · 1/8** | **0.532 · 6/8** | **0.516 · 2/8** |
| W3 ε≥0.40 | ≤ 0.507, at most 1/8 in any cell, never detected |||||||

**MDE and void flags under the pre-registered rule.**

| channel | C1 | C2 |
|---|---|---|
| W1 payload bit | **void**: not detected at ε = 0 | no MDE: detected at ε = 0, but only in 4/8 worlds |
| W2 timing +30 s | ε = 0 | ε = 0 |
| W3 length word | ε = 0 | ε = 0 |

**Under the pre-registered rule, the negative result for C1 is void.** The pipeline does not detect a deterministic one-bit agent leak hidden in a random word. The A1 features see a word only through its 64-bit Hamming distance, its low-16 equality and its per-side residues. One agreeing bit among 63 uniform bits is too weak in those features (amendment A2, "Why").

The pre-declared expectation "ε = 0.30 detected everywhere" is **not met** in any channel:
- W3 at ε = 0.30 is detected combined in 5 / 6 cells, but in at most 6 / 8 worlds.
- W1 and W2 at ε = 0.30 are not detected at all.

## Secondary result: A2, post hoc (`results/a2/classifiers.json`)
A2 adds per-bit agreement features: the low 64 bits of every position. Everything else is unchanged. Feature check: 0 / 2,400 mismatches.

**Fresh: NO LINK in all 6 cells.**
- Holm-adjusted p ≥ 0.94; mean AUC from 0.497 to 0.505.
- Per-world AUC ranges from 0.485 to 0.516, and the smallest per-world p is 0.085.

| variant | C1 logreg | C1 rf | C1 knn | C2 logreg | C2 rf | C2 knn |
|---|---|---|---|---|---|---|
| W1 ε=0 | **0.692 · 8/8** | **0.754 · 8/8** | **0.547 · 7/8** | **0.714 · 8/8** | **0.757 · 8/8** | **0.552 · 8/8** |
| W1 ε≥0.30 | ≤ 0.509, at most 1/8 in any cell, never detected |||||||
| W2 ε=0 | **0.525 · 3/8** | **0.546 · 8/8** | 0.504 · 0/8 | **0.529 · 6/8** | **0.552 · 7/8** | 0.507 · 0/8 |
| W2 ε≥0.30 | ≤ 0.506, 0/8 in every cell |||||||
| W3 ε=0 | **0.725 · 8/8** | **0.756 · 8/8** | **0.732 · 8/8** | **0.740 · 8/8** | **0.760 · 8/8** | **0.749 · 8/8** |
| W3 ε=0.30 | 0.508 · 0/8 | **0.515 · 2/8** | 0.504 · 0/8 | 0.506 · 0/8 | **0.526 · 3/8** | 0.507 · 1/8 |
| W3 ε≥0.40 | ≤ 0.505, at most 1/8 in any cell, never detected |||||||

**MDE in A2: ε = 0 for every channel and task; no void flag.**
- The W1 control at ε = 0 now reaches AUC 0.754 / 0.757 (rf). The derived maximum is 0.75.
- A2 has a cost. The ≈ 2,000 added features are noise for W2 and W3, so power drops:
  - W2 rf: 0.565 → 0.546 (C1) and 0.581 → 0.552 (C2);
  - W3 at ε = 0.30: 5 / 6 detected cells → 2 / 6.
- No single feature set dominates. The two runs together cover all three channels at ε = 0.

## What this means for the paper
1. **No link on real v9.2 transcripts**, in 8 independent worlds with D ∈ {2, 3, 4} and two fan-outs, under both feature sets. The stated power is "per-unit leaks of the size of the controls at ε = 0".
2. **Calibrated power** (both runs). Effect sizes are pair-level AUC.
   - **Reliable per-world detection** (≥ 7 / 8 worlds) is reached by every control whose mean AUC is ≥ 0.546.
     - The 0.546 is W2 C1 rf in A2. The weakest such control in the primary run is W2 C1 logreg at 0.557.
   - **Combined detection only** (fewer worlds) reaches AUC 0.511–0.532: W3 at ε = 0.30 in the primary run, and the W1 C2 rf / knn cells at ε = 0 in the primary run.
   - **Missed** (not detected combined): every control cell with mean AUC ≤ 0.511, except one (primary W3 C1 logreg at ε = 0.30, 0.511). Examples:
     - the primary W1 C1 cells at ε = 0 (0.507–0.511);
     - the W2 knn cells at ε = 0 (A2: 0.504, 0.507);
     - every cell at ε ≥ 0.40.
3. **Leaks at ε ≥ 0.40 are not testable at this sample size.**
   - The derived best pair AUC is ≤ 0.51 (A2, "Reference values").
   - The honest statement is "no link detected at pair AUC above ≈ 0.55 per world, or ≈ 0.52 combined". "No weak link" cannot be claimed.
4. **The primary C1 negative is void by its own rule.** The feature gap was found by the pre-registered positive control, which is the purpose of that control. The rescue (A2) is post hoc and must be labelled so.

## Deviations
- **A1** is listed in the pre-registration. It was made before the real transcripts were analysed.
- **A2** is post hoc and secondary. The primary result is unchanged.
- Recording changes:
  - The `classify` output gained a `feats` field after the primary run. The primary file was produced without that field.
  - The A2 classify run used 5 workers instead of 8, for memory. Workers do not affect the results; seeds are per world and task.
- Expectations not met: ε = 0.30 (all channels), and W1 at ε = 0 in the primary run.
- Generation used 8 parallel processes and took ≈ 5 h (14:17–19:17 UTC; `results/gen_w*.stderr`).

## Corrections after audit #78 (2026-10-15; no new experiment)
- **The amendment A1 statement "looking scores up is identical to re-scoring" is not literal.** `featurize` is asymmetric in (a, b), and the pool scores each unordered pair once (i < j); swapping a pair changes a logreg score by up to 0.607 (audit). Observed and null use the same canonicalised statistic, so the test is **still valid**, but its statistic is "the score of the canonical order".
- **The C1 null permuted transcript labels across rounds.** That is outside the design's symmetry group, which keeps one action per agent and round. E6e corrected this with within-round permutation. The audit compared both nulls on the same scores (SD 0.0103 vs 0.0102), and **no decision changes**: C1 remains void.
- **W2's theoretical maximum AUC at ε = 0 is 0.609, not ≈ 0.57.** `a mod 600` reveals U + 30b. Exact enumeration gives 0.609375; the audit gives 0.518 at ε = 0.3. The measured 0.546–0.584 is therefore below what this control allows, so "W2 is weak by design" overstated the weakness.
- **C2 control strength depends on the drawn bits** in worlds with only 4 test parents. The AUC ceilings at ε = 0 are 0.833 (w3, w5), 0.750 (w1, w6, w8) and 0.714 (w4, w7), and the control signal is 0 if all 4 bits coincide (probability 1/8). No seed hit that case.
- **Cluster bootstrap:** `cluster_ci` clusters by agent for C2 too, although C2's dependence unit is the parent (the same issue as #54's open item 3). Both E6d and E6e bootstrap with fixed scores, without refitting; this was not stated before.
- **A2's "check_a2 … ran before this commit" cannot be verified.** The committed `feature_check_a2.json` comes from the run that started at 19:35:34Z, after the 19:35:28Z push of 15f8eb0. The check reads no labels, so A2's post-hoc status is unchanged.
- **Wording.** "No link detected at pair AUC above ≈ 0.55" refers to the AUC **these classifiers and features attain**, not to the strength of a leak. A leak these features cannot see — a single bit in a random word under F1 — would go undetected at any strength.
