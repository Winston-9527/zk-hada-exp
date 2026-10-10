# T7 — proof material and mechanization review (issue #9) — plan (committed BEFORE any Lean build or check)
Base: main d4e1e3b. Object of review: `mechanization/` of the main repo ZK-HADA (commit 7966d60; files Basic, CryptoAssumptions, TANON, TNFF;
Lean v4.31.0-rc2, mathlib 261b5e31) and paper.tex §4 (Security Model: 7 assumptions, 6 games, 6 reduction theorems).
paper.tex already states (lines 341, 598) that the proofs are NOT mechanized; T7 checks whether the Lean files could be cited as evidence at all, and
maps every claim to its assumption, proof status and implementation evidence.

## Checks (each reproducible; results go to LEAN_AUDIT.md with the command output)
L1 Build: `lake build` of an unmodified copy of `mechanization/` with the pinned toolchain and mathlib cache. Record every error. (Static reading
   suggests TNFF.lean references undefined names: Oracle, ShamirShareOracle, shamir_real/ideal, elgamal_*, eddsa_*, shamir_oracle, elgamal_oracle,
   *_bound. To be confirmed by the build, not assumed.)
L2 Inventory: every `axiom`, `sorry`, `def ... := 0`, constant win probability, with file:line.
L3 Vacuity: for each axiom in CryptoAssumptions.lean, show in Lean that its statement is provable without the axiom (its conclusion is `True`).
L4 Consistency: in TNFF.lean, `Gnff_body := PMF.pure false` makes PrWin H4 = 0 while axiom `H4_ideal` states PrWin H4 = 1/2. Attempt a Lean proof of
   `False` from the file's axioms (in a separate audit file importing an unmodified copy). If the file does not build (L1), do the same on the smallest
   self-contained extract of the involved definitions and say so.
L5 Meaning of the "theorems": what TANON.main / TNFF_main actually state given the definitions (e.g. Adv of a constant 3/4 game).
`#print axioms` for every top-level theorem that builds.

## Claim map (CLAIM_MAP.md, for party A)
For each paper assumption / game / theorem and each property the experiments test: statement as in paper.tex; whether a proof exists (paper sketch /
none / mechanized); which system version it describes vs v9; the implementation evidence (experiment, file) — kept in a separate column and never
called a proof; gaps (missing games, assumptions not listed, outdated statements). Scope rule: findings that do not break a research-design goal are
disclosed, not fixed; T7 does not rewrite the paper's proofs or the Lean development (decision for the user / party A).
