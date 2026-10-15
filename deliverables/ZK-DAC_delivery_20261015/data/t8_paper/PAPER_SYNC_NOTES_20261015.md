# Paper sync notes for party A (from audit #76–#81, 2026-10-15)
Party B does not edit `paper.tex` / `experiments.tex`. These are the places where the paper (T8 chapter, last changed 2026-10-12) no longer matches the evidence of PR #62–#74.

1. **Q4, privacy power (`experiments.tex:66-72`, `numbers.tex:143`)** (#78 F1).
   - The text says "bit-level pair features" and suggests that leaks above the null q99 (`\NLinkNullQninetynine` = 0.70) would be noticed. E6d shows that the same features reach only AUC ≈ 0.51 against a deterministic single-bit leak (W1, ε = 0).
   - Suggested: use the empirical detection limits of E6d A2 and E6e ("pair AUC attained by these classifiers ≳ 0.54–0.55, detected in every world"). State the E6b features' blind spot. Drop or qualify "bit-level". Note that 0.006 (`\NCtrlHolm`) is a Holm floor.
2. **Budget races (`experiments.tex:158`, "one sender in a fixed order")** (#79). Superseded by E2b: 30 paired seeds × 16 cells, logical clock. Every second E2b reports is a logical-clock second under t_p = 1.377 s.
3. **Revocation, "0 false accepts".** Cite circuit evidence, T5d's substitute witnesses and T5b, not T5c I1. I1 measures the window against root replay (#76).
4. **T5c I1 window statement.** It holds under the logical clock only: zero propagation delay, next-block inclusion (#79 F4).
5. **E8 A1** is an authorization-layer stand-in. The local gateway does not bind (id, tool) or single use (#77 F3). **E8 A3** failures came mostly from capability coverage, not from stranded budget (#77 F1).
6. **T7c R1** supports the nullifier and revoked-root window checks only. The amount and membership clauses rest on X1 / X3 / T3 (#76 F2, F3).
7. **Timing sources.** T8c's `TIMING_SOURCE_AUDIT.md` is a 10-14 snapshot; re-check before finalising (#81 F6). Absolute proving times drift by ≈ 5 % between sessions, so quote paired, dated numbers (T8c A).
