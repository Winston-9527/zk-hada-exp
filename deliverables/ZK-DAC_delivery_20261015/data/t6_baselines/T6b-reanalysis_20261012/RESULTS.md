# T6b — results (post hoc, audit #58)
Pre-registration: `PREREGISTRATION.md` (pushed before running). `node analyze_t6b.mjs > results/analysis_t6b.json`.

## Privacy-cost ratio v9 ÷ B0 depends on accounting (`results/analysis_t6b.json` → `ratio_grid`, `ranges`)
| D | T6 reported (law pc 0 / B0 first; T5 world / B0 first) | range over the grid, fresh tree | range, T5 world mean |
|---|---|---|---|
| 1 | 4.66 ; 5.96 | 4.66 – 6.70 | 5.96 – 8.63 |
| 2 | 3.56 ; 4.61 | 3.56 – 5.69 | 4.61 – 7.00 |
| 3 | 2.90 ; 3.81 | 2.90 – 4.49 | 3.81 – 5.95 |
| 4 | 2.45 ; 3.25 | 2.45 – 3.90 | 3.25 – 5.18 |

- **T6 used the choice that gives the smallest ratio:** B0's first (cold) execution, with intrinsic gas.
- The other choices are:
  - B0's steady second execution;
  - 21,000 intrinsic gas removed on both sides;
  - the measured v9 receipt (D = 4: 564,147 → 2.47 instead of 2.45 from the extrapolated 560,628).
- **Overall range: 2.45 – 6.70 on a fresh tree, 3.25 – 8.63 at T5 world size.**
- **Wording.** B0 is a self-written plaintext reference gate with one cold SSTORE per hop, not a proven lower bound. The ratio is reported as the
  range above. The claim "the ratio shrinks with D and crosses near D ≈ 15" holds only for B0's design; it is dropped as a general statement.
- B0 medians, exact: 115,215 / 153,062 / 190,883 / 228,705 (first execution) and 98,115 / 118,856 / 139,577 / 160,317 (second execution).
  T6's analysis.json had rounded them (115,200 …).

## Component test, paired as pre-registered (`components_paired`)
- Paired by instance seed; sign-flip permutation, 10^4; Holm over 12.
- Every decision is the same as T6's unpaired test except **v8 → v9 at D = 2: −7.0 ms, p_holm = 0.031** (T6: not significant).
- v8 → v9 at D = 1, 3, 4: −1.5 / −5.7 / −5.3 ms, not significant.
- The v9 compression therefore makes proving at most a few ms *faster* (≤ 0.4 %). "No significant effect" is replaced by "at most −7 ms (D = 2)".
- Unchanged:
  - accountability (v6 → v7) +65 / +74 / +620 / +84 ms;
  - budget (v7 → v8) +86 / +85 / +87 / +63 ms;
  - all p_holm = 0.0012.
