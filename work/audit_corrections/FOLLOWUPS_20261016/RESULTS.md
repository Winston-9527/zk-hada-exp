# Audit follow-ups F1–F3 (2026-10-16): results

- **Pre-registration:** `PREREGISTRATION.md` (6a99449, pushed before any run).
- **Machine:** Apple M5 Pro. F2 is the only timing item; no other project process ran during it.

## F1 — E6e M2 / M3 cluster-bootstrap CIs (`F1_e6e_ci/`)
- **Reproduction check passed.** The test procedure is `analyze_e6e.m2_test` verbatim, with a CI block inserted. AUC and p equal the committed `m2.json` / `m3.json` in **66 / 66 M2 cells and 12 / 12 M3 cells**, 0 mismatches.
- **CI method.** 95 % cluster bootstrap over the test units (masters for M2a-M and M2b-M, parents for M2a-P and M2b-P), 2,000 resamples, **fixed scores**: the model is not refit.
- **Fresh transcripts:** **11 of 12 CIs contain 0.5.** The exception is **M2b-M rf**, AUC 0.516 with CI [0.503, 0.530].
  - Its permutation p is 0.010; the Holm-adjusted p is 0.115, so it is **not detected** under the pre-registered rule.
  - The CI is neither a test nor corrected for 12 cells. One nominal 95 % interval out of 12 excluding 0.5 is compatible with chance.
  - It is the largest fresh effect in M2 and is reported as such.
- **Controls** (`m2_ci.json`):
  - K1 at λ = 1: CIs from [0.629, 0.792] (M2a-M rf, only 16 test masters) to [0.753, 0.788];
  - K1 at λ = 0.5: lower bounds ≥ 0.552 for logreg and rf;
  - K2: lower bounds ≥ 0.524.
- **M3 fresh:** all 6 CIs contain 0.5.
- This closes the deviation recorded in E6e's Corrections (audit #78 F7).

## F2 — counterbalanced paired benchmark, v9.1 vs v9.2 (`F2_paired/`)
- **Design.** Order A B B A B A A B (A = v9.1, B = v9.2); 4 runs each; D = 1..4; 10 fresh instances per run. **32 / 32 blocks verified 10 / 10.**

| D | v9.1 runs (ms) | v9.2 runs (ms) | mean v9.2 − v9.1 | adjacent-pair differences (AB, BA, BA, AB) |
|---|---|---|---|---|
| 1 | 815, 793, 829, 799 (SD 17) | 799, 796, 793, 798 (SD 3) | −12.2 (−1.5 %) | −16, +4, −36, −0 |
| 2 | 1,454, 1,423, 1,470, 1,424 (SD 23) | 1,414, 1,410, 1,410, 1,416 (SD 3) | −30.0 (−2.1 %) | −40, −13, −60, −8 |
| 3 | 2,351, 2,289, 2,322, 2,310 (SD 26) | 2,311, 2,298, 2,289, 2,290 (SD 10) | −20.8 (−0.9 %) | −39, +9, −33, −20 |
| 4 | 2,605, 2,579, 2,597, 2,582 (SD 12) | 2,586, 2,581, 2,584, 2,624 (SD 20) | +3.0 (+0.1 %) | −20, +2, −13, +42 |

- **With the order balanced, the earlier +25 ms (T8c A, fixed order v9.1 → v9.2) disappears.**
  - The differences are −2.1 % to +0.1 %. The signs are mixed within D = 1, 3 and 4. At D = 2 all four are negative, but they stay within about 2 × the v9.1 run-to-run SD.
  - **v9.2 is not slower than v9.1**, and T8c's positive mean was an order artefact (audit #80 F8 confirmed).
- **Load.** The load average rose from 2.9 to 14.6 during the 8 runs; snarkjs's own worker threads are a large part of it. The balanced order spreads that drift over both versions.

## F3 — window boundaries and mutation sensitivity (`F3_windows/`)
| check | result |
|---|---|
| (a) existing `V92.t.sol:test_GB7` on the revoked-root boundary (accepted at t0 + Δ, rejected at + Δ + 1, real v9.2 proof) | passes; revocation at t0 = NOW exactly (no warp in the steps) |
| mutation: `ZkDacRevocations.rootAccepted` `<=` → `<` | **caught**: `test_GB7` fails (StaleRevokedRoot at t0 + Δ) |
| (b) new `T7cWindowBoundary.t.sol`: note root accepted at retirement + NWIN, rejected at + NWIN + 1 | passes |
| (b) new: issued root accepted at update + 300, rejected at + 301 | passes |
| mutation: `ZkDacGateV9._rootOk` `<=` → `<` | **caught by the new tests** (StaleNoteRoot, StaleIssuedRoot). **The original V92 suite passes 11 / 11 under this mutation**, so the gap was real and is now closed |
| full forge suite, unmutated | **380 / 380** (367 before + 13 in the new file: 2 new tests + 11 inherited from V92Test) |

- **Finding.** The revocation-window boundary was already tested at gate level with real proofs. The audit's point (#81 F7) applied to T7c's differential test, which cannot reach the boundary.
- **New coverage.** The gate's other two windows had no accept-at-boundary test, and a `<` mutation survived the suite. Both are now covered.
- **Reruns used.** Only the existing committed fixtures; no new proofs.
