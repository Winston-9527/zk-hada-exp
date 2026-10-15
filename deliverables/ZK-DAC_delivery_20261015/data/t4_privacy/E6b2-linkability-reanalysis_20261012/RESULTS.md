# E6b2 — re-analysis of the E6b transcripts with a decision rule that can fire — results (post hoc, audit #54)
Pre-registration (amendment A2, post hoc): `PREREGISTRATION.md` (59c05f5, pushed before any A2 run).

Runs (Apple M5 Pro):
- smoke, 2 permutations: `results/smoke_perms2.json`, kept;
- `analyze2.py classify 1000 > results/classifiers_a2.json`: 3 h 57 min, `results/classifiers_a2_time.txt`;
- `analyze2.py c3 > results/c3_exact.json`: 2 min.

## Verdict
- **No link detected between v9 transcripts (C1 same agent, C2 siblings), every seed and model, under a rule that can fire.**
  - All 6 primary cells per seed: Holm-adjusted p = 1.
  - The smallest raw p over 3 seeds is 0.27.
  - The largest cluster-CI lower bound is 0.471 (threshold 0.55).
- **Both positive controls are detected in every cell by the same rule:** 18 / 18, Holm-adjusted p = 0.006 < 0.01, and cluster-CI lower bound ≥ 0.906.
  So the negative result is not void, as it was in E6b under its own rule.
- **C3 (master) cannot be tested at this size,** as pre-registered. The exact unit-level p over all 70 labellings is 0.49 – 0.80, against a minimum
  attainable 0.029. The pooled AUCs (0.04 – 0.37) equal the null means (0.14 – 0.34), which is the grouped-CV artefact of A1, not a signal.
- **Power boundary.** The 99th percentile of the null AUC is 0.62 – 0.70 for C1 and 0.54 – 0.57 for C2. A leak that moves the classifier's AUC less
  than that is not detectable here. The controls (AUC ≈ 1) are leaks of the D1 kind (equal words); there are no weak-leak controls (pre-registered
  exclusion).
- The deterministic tests of E6b (0 shared values, 0 equal ciphertext differences, 512 distinct budget nullifiers) remain the main evidence. The
  classifiers add "no learnable signal beyond those, at the above power".

## Classifiers (`results/classifiers_a2.json`; pooled out-of-fold AUC [95 % cluster-bootstrap CI over agents], raw permutation p over 1,000 unit-level permutations)
| | seed 0 | seed 1 | seed 2 |
|---|---|---|---|
| C1 logreg | 0.527 [0.469, 0.593] p 0.39 | 0.504 [0.445, 0.563] p 0.51 | 0.478 [0.422, 0.534] p 0.64 |
| C1 RF | 0.522 [0.452, 0.591] p 0.33 | 0.485 [0.423, 0.549] p 0.50 | 0.455 [0.405, 0.507] p 0.69 |
| C1 k-NN | 0.515 [0.455, 0.568] p 0.31 | 0.522 [0.471, 0.579] p 0.27 | 0.502 [0.444, 0.562] p 0.42 |
| C2 logreg | 0.471 [0.395, 0.547] p 0.80 | 0.499 [0.425, 0.581] p 0.44 | 0.459 [0.375, 0.534] p 0.91 |
| C2 RF | 0.421 [0.323, 0.517] p 0.99 | 0.421 [0.325, 0.507] p 0.99 | 0.408 [0.316, 0.491] p 1.00 |
| C2 k-NN | 0.499 [0.430, 0.574] p 0.43 | 0.488 [0.404, 0.565] p 0.64 | 0.459 [0.393, 0.523] p 0.93 |
| **P1 control (C1), 3 models** | 1.000 [1.000, 1.000] p 0.001 | same | same |
| **P2 control (C2), logreg / RF / k-NN** | 1.000 / 1.000 / 0.976 [0.954, 0.991], p 0.001 | 1.000 / 1.000 / 0.951 [0.906, 0.982] | 1.000 / 1.000 / 0.970 [0.952, 0.986] |

- Holm within each family of 6 per seed: primary cells 1.0; control cells 0.006.
- AUCs below 0.5 for C2 RF are the grouped-CV prior shift described in A1. They match the null distribution (p ≈ 1) and are not evidence of
  anything.
- The cluster CIs are 1.5–2× wider than E6b's pair-bootstrap CIs, which are also stored (`ci95_pairs_e6b`). The point AUCs equal E6b's, because the
  folds and pairs are the same.

## Deviations
None from A2. A2 itself is post hoc: it was written after E6b's results and after audit #54.
