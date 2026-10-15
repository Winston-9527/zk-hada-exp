# E6b2 — re-analysis of the E6b transcripts with a decision rule that can fire (amendment A2, POST HOC)
Status: **post-hoc amendment**, written 2026-10-12 after the E6b results were known and after audit issue #54. Committed and pushed before any
A2 run. E6b (`../E6b-linkability-v9_20261010/`) stays as it is; this directory only reads its transcripts.

## Why (audit #54, verified)
1. E6b decided LINK iff Holm-adjusted permutation p < 0.01 over 9 tests with 100 permutations. The smallest permutation p is 1/101 and the
   smallest Holm-adjusted p over 9 tests is 9/101 ≈ 0.089, so the primary test could never report LINK whatever the leak.
2. The positive controls were judged with the raw p (1/101 < 0.01), i.e. by a different rule. Under the primary rule they would also have failed,
   so "the pipeline has power" did not follow.
3. C3 (master) has 8 parents split 4 / 4: a unit-level permutation has C(8,4) = 70 labelings and the M0/M1 swap gives the same AUC, so the exact p
   is at least 2/70 ≈ 0.029 for any leak. C3 cannot reach α = 0.01 at this corpus size.
4. The bootstrap CI resampled pairs as if independent; the independent units are the 64 agents.

## Data
`../E6b-linkability-v9_20261010/results/transcripts_{fresh,p1,p2}.jsonl`, unchanged (sha256 in that directory's MANIFEST). No new proofs.
Features, models, folds, pair sampling and the unit-level permutation of A1 are reused unchanged (`analyze.py` imported read-only).

## Changes
1. **Families.** Primary family = {C1 same agent, C2 siblings} × {logreg, RF, k-NN} = 6 tests. Control family = {P1 on C1, P2 on C2} × 3 models
   = 6 tests. Holm within each family, per seed.
2. **Permutations:** 1,000 per test (smallest Holm-adjusted p = 6/1001 ≈ 0.006 < 0.01).
3. **One rule for both families:** LINK / detected iff Holm-adjusted p < 0.01 AND pooled AUC 95 % CI lower bound > 0.55. The negative result is
   void if any control cell is not detected.
4. **CI:** cluster bootstrap over agents (2,000 resamples; a pair is weighted by the product of its two agents' multiplicities).
5. **C3:** reported descriptively with the exact unit-level permutation distribution over all 70 labelings; declared **not testable at α = 0.01**
   in this corpus and excluded from the decision.
6. Seeds 0, 1, 2 as in E6b.

## Not changed / disclosed
- No weak-leak controls (biased bits, partial randomness reuse). The controls show power only against leaks of the D1 kind (equal words); the
  deterministic tests remain the main evidence and the classifier result is supplementary.
- The pre-registration said the roots were one snapshot; note_root (public position 24) changes with every action. Actions are round-robin, so two
  transcripts of one agent are never in the same round.
- The 0.55 CI threshold is kept from E6b; it has no derivation beyond "clearly above chance".

## Outputs
`results/classifiers_a2.json`, `results/c3_exact.json`, `RESULTS.md`, `RUN_RECORD.md`. Failures kept.
