# T6b — re-analysis of T6 under alternative gas accounting and the pre-registered paired test (post hoc, audit #58)
Written 2026-10-12 after audit #58; committed and pushed before running. No new measurements: reads
`../T6-baselines_20261010/results/{b0_anvil.json,comp_bench.jsonl}` and `../../t5_e2e/T5-e2e-scale_20261010/results/analysis.json`.
T6 stays as it is.

## Why (audit #58, verified)
1. The privacy-cost ratio v9 ÷ B0 depends on accounting choices that T6 fixed silently:
   - B0's first (cold-storage) execution vs its steady second execution;
   - receipt gasUsed including the 21,000 intrinsic gas vs without it (the pre-registration said "excludes intrinsic", the code used receipts);
   - v9 "fresh tree" as the fitted law at popcount 0 (560,628 at D = 4, an extrapolation) vs the measured near-empty receipt (564,147).
2. B0 is a self-written plaintext gate, not a proven lower bound.
3. The component test was pre-registered as paired, but `perm()` permutes two independent samples. The instances are paired by seed across
   versions.

## Analysis (`analyze_t6b.mjs`)
- **Ratio grid** for D = 1..4:
  - v9 ∈ {law at popcount 0, measured receipt where one exists (v9 RESULTS: D = 2 577,509, D = 4 564,147), T5 world mean};
  - B0 ∈ {first-execution median, second-execution median};
  - each with intrinsic gas and with 21,000 subtracted on both sides.
- **Paired component test:** for each D and consecutive version pair, per-seed differences of prove_ms; sign-flip permutation test (10^4, seed
  fixed); Holm over the 12 comparisons. Decisions are compared with T6's unpaired ones.
- The exact B0 medians are reported; T6's analysis.json rounded them (115,200 vs 115,215).

## Reporting rule
- The paper reports the ratio as a range over the grid, with the T6 choice marked, and calls B0 a "plaintext reference gate", not a lower bound.
- If the paired test changes any decision, the paired result replaces T6's.
