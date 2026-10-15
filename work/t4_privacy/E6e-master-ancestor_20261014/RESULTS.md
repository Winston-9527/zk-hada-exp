# E6e — master linkage, corrupted ancestor, colluding verifier (WP11): results

- **Pre-registration:** `PREREGISTRATION.md`.
  - 8a8ea87: pushed before the world was built.
  - Amendment A1, 40598e9: before any analysis of real transcripts; the analysis was developed on synthetic worlds only.
- **Commands and the failed attempt 1:** `RUN_RECORD.md`.
- **Object:** v9.2 (main 8a7cd87). Everything ran locally on the Apple M5 Pro.

**Scope.** These are empirical results, not proofs. They cover the listed adversaries, features and classifiers, at the measured power. Designed leakage is not tested (pre-registration, "Allowed leakage"): active revocation probing, the committee's opening, and an ancestor's knowledge of its own subtree.

## Corpus
- World M: D = 3, 32 masters × 4 parents × 4 agents (512 agents), 8 rounds.
- **4,096 / 4,096** real v9.2 proofs verify (`results/verify.json`).
- Adversary knowledge is in `results/knowledge.json`: public keys, certificates, key hashes and initial notes of all 512 chains. It contains no secret keys.

## D3 — dictionary test (`results/d3_dictionary.json`): all 0
The dictionary holds every value an ancestor can compute: 8,536 values including negations, from the union of all adversaries' knowledge.
- Transcript words equal to a dictionary value: **0**.
- Ciphertext residuals e_j − y_j equal to 0, or to a dictionary value, over every candidate y at every position (2,883,584 residuals): **0 and 0**.
- Equal masks inside one transcript (true chain): **0**.
- budget_nf or cm_change equal to a dictionary value: **0**.

## M1 — outside observer (`results/m1.json`, B = 5,000; 18-cell Holm family)
**Fresh: NO LINK in all 18 cells.**
- Holm-adjusted p = 1.0 in every cell; the smallest raw p is 0.068 (C1 / F2 / rf).
- AUC ranges from 0.482 to 0.518. The null 99 % quantiles lie between 0.523 and 0.528.
- **The master task C3** (32 masters; the E6b2 gap): AUC 0.490–0.513 over 6 cells. For example, rf with F1 has AUC 0.490, 95 % cluster CI [0.461, 0.527], p = 0.84.

**Controls.** Each cell gives the best AUC over models and feature sets. ✓ = detected (Holm < 0.01 within the 18-cell family).

| channel | ε = 0 | ε = 0.20 | ε = 0.30 | ε = 0.40 | MDE: C1 / C2 / C3 |
|---|---|---|---|---|---|
| W1 payload bit | ✓ F2 only (rf 0.755 / 0.765 / 0.747); F1 ≤ 0.528, not detected | C1 F2 rf 0.544 ✓; C2, C3 not detected | not detected | not detected | 0.20 / 0 / 0 |
| W2 timing +30 s | ✓ (F1 rf 0.584 / 0.578 / 0.580) | not detected | not detected | not detected | 0 / 0 / 0 |
| W3 0/1 word | ✓ (0.72–0.77, all cells) | ✓ 14 / 18 cells (0.538–0.609) | C3 F1 rf 0.544, knn 0.540 ✓ | not detected | 0.20 / 0.20 / 0.30 |

**No void flag.** Every channel and task is detected at ε = 0.
- E6d showed that F1 alone misses W1. It does so again here (F1 ≤ 0.528), so the pre-registered union of F1 and F2 was necessary.
- Expectation "ε = 0.20 detected for W1 and W3": met for W3 in all tasks, but for W1 only in C1.

## M2 — corrupted ancestor (`results/m2.json`, B = 5,000; 12-cell Holm family)
**Fresh: NO LINK in all 12 cells.**
- Holm-adjusted p ≥ 0.115. The smallest raw p is 0.010 (M2b-M rf, AUC 0.516, Holm-adjusted 0.115).
- Top-1 accuracy is at chance:
  - M2b-P (which of 4 agents): 0.239–0.266, chance 0.25.
  - M2b-M (which of 16 agents): 0.050–0.069, chance 0.0625.

| task | rows (test / train) | features | fresh AUC (logreg / rf / knn) |
|---|---|---|---|
| M2a-M: master, "is it my subtree?" | 32,768 / 22,048 | 324 | 0.489 / 0.496 / 0.500 |
| M2a-P: parent, "is it my subtree?" | 131,072 / 22,048 | 582 | 0.497 / 0.508 / 0.505 |
| M2b-P: parent, "which of my 4 agents?" | 8,192 / 8,192 | 972 | 0.501 / 0.511 / 0.494 |
| M2b-M: master, "which of my 16 agents?" | 32,768 / 22,048 | 972 | 0.500 / 0.516 / 0.490 |

**Controls.** Best AUC per task; ✓ = detected.

| control | derived max AUC | M2a-M | M2a-P | M2b-P | M2b-M |
|---|---|---|---|---|---|
| K1 λ = 1 (one keystream bit leaks) | 0.75 | 0.752 ✓ | 0.748 ✓ | 0.771 ✓ (top-1 0.498) | 0.754 ✓ (top-1 0.131) |
| K1 λ = 0.5 | 0.625 | 0.614 ✓ | 0.604 ✓ | 0.619 ✓ | 0.602 ✓ |
| K1 λ = 0.2 | 0.55 | 0.520 | 0.519 | 0.522 ✓ (logreg only) | 0.520 |
| K1 λ = 0.1 | 0.525 | 0.508 | 0.506 | 0.508 | 0.507 |
| K2 λ = 0.1 (keystream reuse in 10 % of transcripts) | — | n/a | n/a | 0.551 ✓ | 0.554 ✓ |

- **No void flag.** The pre-declared expectations hold: K1 at λ ∈ {1, 0.5} is detected for every task, and K2 is detected for both M2b tasks.
- At λ = 0.2, only M2b-P is detected.
- At λ = 0.1, nothing is detected. The derived ceiling, 0.525, is at the edge of the null's 99 % quantile.

## M3 — colluding verifier + corrupted ancestor (`results/m3.json`; 6-cell Holm family)
The features are M2's plus the verifier's view: method, target, amount, params, now, and the submission index.
- **Fresh: NO LINK.** Holm-adjusted p ≥ 0.566; AUC 0.491–0.508.
- Sanity control K1 at λ = 1: detected, AUC 0.741–0.768.

## What this means for the paper (research design Q4)
1. **Master linkage is now testable, and no link was detected.**
   - 32 masters, B = 5,000, and the minimum attainable p of 2 × 10⁻⁴ passes Holm.
   - The C3 control is detected down to ε = 0.30 (W3) and ε = 0 (W1, W2).
   - This closes the E6b2 gap, where p < 0.05 was unattainable.
2. **A corrupted ancestor gains nothing measurable beyond L.**
   - It knows every public key, certificate and revocation handle of its subtree.
   - It is tested both at subtree membership and at naming the descendant.
   - Exact dictionary matches: 0. Classifier advantage: none detected.
   - A one-bit keystream defect (K1) is detected with λ down to 0.5 everywhere and down to 0.2 for M2b-P. Keystream reuse in 10 % of transcripts is detected.
3. **Adding the verifier's view changes nothing.** It is i.i.d. by construction; the result checks that combining views does not create a signal.
4. **Wording:** "no link detected by the tested adversaries above the measured MDE". Pair AUC above ≈ 0.54–0.55 is reliably detected; one-bit leaks in fewer than 20 % of transcripts are not.

## Deviations
- **Attempt 1:** the analysis chain failed because the scripts were missing (`RUN_RECORD.md`). No data were lost, and no analysis read the data. Attempt 2 is the reported run.
- None in design or analysis beyond amendment A1.

## Corrections after audit #78 (2026-10-15; no new experiment)
- **Deviation not listed before:** the pre-registration (:143) asks for a 95 % cluster-bootstrap CI per AUC in M2 and M3, but `m2.json` and `m3.json` report none. "None in design or analysis beyond amendment A1" is therefore wrong. M1 reports CIs; M2 and M3 report AUC, p and null quantiles only.
- **Power wording.** "One-bit leaks in fewer than 20 % of transcripts are not detected" is too broad. At λ = 0.2 one task out of four (M2b-P) is detected, at Holm p = 0.0096, right at the threshold.
  - The λ = 0.1 explanation "at the edge of the null's 99 % quantile" is wrong. With 18 Holm-corrected cells and B = 5,000, a cell needs raw p ≤ 5.6 × 10⁻⁴, at most 1 null exceedance. The effective threshold is close to the null maximum, ≈ 0.533–0.540.
  - The final statement, "≈ 0.54–0.55 reliably detected", is consistent with that threshold.
- The pair-scoring construction inherited from E6d (canonical pair order, see E6d Corrections) also applies to M1. The test remains valid.

## Follow-up 2026-10-16: M2 / M3 CIs added
The missing pre-registered CIs are in `work/audit_corrections/FOLLOWUPS_20261016/F1_e6e_ci/`. AUC and p reproduce exactly, 78 / 78 cells.
- Fresh M2: 11 of 12 CIs contain 0.5. The exception is M2b-M rf, 0.516 with CI [0.503, 0.530] and Holm p 0.115, so it is not detected under the pre-registered rule.
- Fresh M3: all CIs contain 0.5.
