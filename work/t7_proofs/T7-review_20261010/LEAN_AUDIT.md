# T7 — Lean mechanization audit (issue #9)
Plan: `AUDIT_PLAN.md` (f26270e, committed before any check).
Object: ZK-HADA `mechanization/` at 7966d60, built **unmodified** (`diff -r` against the source copy: identical). Lean v4.31.0-rc2 (elan via Homebrew);
mathlib 261b5e31 from the mathlib cache (`cache_get.log`; the first attempt failed on a network error, `cache_get_run1_network_error.log`).
Evidence files: `L1_build.log` (`lake build`), `L2_inventory.txt` (grep), `Audit.lean` + `Audit_output.txt` (`lake env lean ../Audit.lean`, exit 0).

## Verdict
**The Lean files are not a mechanized proof of any paper theorem and must not be cited as one.**
- TNFF.lean does not compile.
- Its axioms are inconsistent with its own definitions, and the statement of its main theorem is provably false.
- TANON.lean compiles, but it proves arithmetic facts about three constants and uses none of the cryptographic assumptions.
- The six "cryptographic assumption" axioms are provable without any axiom, so they assume nothing.

paper.tex already says the proofs are not mechanized (lines 341, 598). That statement is correct and should stay. The Lean directory should not be
shipped as an artifact that suggests otherwise.

## L1 Build
| module | result |
|---|---|
| ZkHada.Basic | builds (10 "unused variable" warnings: every `Adv_*` ignores its arguments) |
| ZkHada.CryptoAssumptions | builds |
| ZkHada.TANON | builds |
| **ZkHada.TNFF** | **fails: 20+ errors** |

TNFF.lean fails with:
- unknown identifiers `Oracle`, `shamir_real` / `shamir_ideal`, `elgamal_*`, `eddsa_*`, `shamir_oracle`, `elgamal_oracle`, `babyjub_elgamal_bound`,
  `shamir_threshold_bound`, `eddsa_euf_bound`;
- type mismatches; unsolved goals.

None of these names is defined in any file or in any commit of the repository: `git log -S` finds them only in TNFF.lean itself (9e24536). So TNFF_main,
TNFF_main_negl and T_poseidon_conditional are not checked by Lean at all. The commit message of a096404 ("complete Lean 4 mechanization … verified")
does not hold for the current tree.

## L2 Inventory (`L2_inventory.txt`)
- **9 axioms:**
  - 6 in CryptoAssumptions.lean (A_Groth16_ZK, A_Poseidon_CR, A_Merkle_BIND, A_BabyJub_ElGamal, A_Shamir_Threshold, A_EDDSA_EUF);
  - 3 in TNFF.lean (H4_ideal, H2_to_H3_eddsa, H3_to_H4_reduction).
- **2 `sorry`:** TNFF.lean:152 and :157 (T_poseidon_conditional).
- **8 advantage functions defined as the constant 0** (Basic.lean:96–103). Any bound of the form `Adv_X ≤ …` is therefore a statement about 0, not about
  an adversary.
- **The adversary is not a program.** `PPT_Adversary` is a record of three functions `ℕ → ℕ/ℝ`. No game samples keys, runs the protocol or gives the
  adversary oracles.
- **TANON games are constants:** G0 = 3/4, G1 = 3/4, G2 = 1/2. TNFF's game body is `PMF.pure false` for all of H0..H4. The oracle arguments are ignored,
  and the "structural oracles" are `PMF.pure ()`.

## L3 Vacuity (Audit.lean, `A_*_provable`, standard axioms only)
Each of the 6 CryptoAssumptions axioms has the shape `∀ A, ∃ ε, (…) → ∀ n, A n x → True`. Each is proved in Audit.lean by
`⟨fun _ => 0, fun _ _ _ => trivial⟩`. They are true statements that constrain nothing.

## L4 Consistency (Audit.lean, `H4_ideal_inconsistent`, `TNFF_main_statement_false`)
TNFF.lean does not build, so these checks run on an extract that keeps the game body verbatim (`PMF.pure false`).
- **`PrWin H4 = 0`** by definition, while `axiom H4_ideal` states `PrWin H4 = 1/2`. Lean derives `False` from it: the axiom set of TNFF.lean is
  inconsistent, so any statement would be "provable" from it.
- **The statement of TNFF_main is false for the game it defines.** PrWin H0 = 0 gives Adv = 1/2. Every Adv_* is 0, and negl 2 = 1/4. Lean proves the
  negation of the statement.
- **T_poseidon_conditional's two `sorry` are unnecessary.** Both sides are built from the constant 0, so Lean proves the statement without `sorry`. The
  theorem therefore says nothing about Poseidon.

## L5 Meaning of TANON.main (Audit.lean)
- `TANON.main : Adv G0 ≤ 1/2` holds for **every** probability p ∈ [0, 1] (`adv_le_half_for_every_probability`).
- `#print axioms TANON.main` shows only Lean's standard axioms (propext, Classical.choice, Quot.sound): **no cryptographic assumption is used.**
- The advantage the file defines is exactly 1/4 (`tanon_adv_is_one_quarter`). Read as a security statement this is **not negligible** (already above
  negl 3 = 1/8): the file models a broken scheme, not an anonymous one.

## What a real mechanization would need (not done; decision for the user / party A)
- An executable model:
  - key generation, the relation, proof oracles, the challenger;
  - cryptographic assumptions stated as games with an explicit advantage, not as constants;
  - reductions as programs.
- Realistic in EasyCrypt / SSProve / CryptHOL; a weeks-to-months effort per theorem.
- Research design line 160 asks for "state-machine invariants on the real transition relation, proved in Lean or a similar tool" (budget conservation, revocation monotonicity).
  That is a smaller, feasible target: model the gate and note set as a transition system and prove the invariants. It does not need probabilistic games.
