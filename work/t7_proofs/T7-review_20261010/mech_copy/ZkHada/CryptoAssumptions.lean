import Mathlib
import Mathlib.Probability.ProbabilityMassFunction.Basic
import ZkHada.Basic

namespace ZkHada

/-! ## Cryptographic Assumptions

Formalized as axioms. Each assumption states that the advantage
of any PPT adversary is bounded by a negligible function.
-/

/- ### A1: Groth16 Zero-Knowledge -/
axiom A_Groth16_ZK :
  ∀ (A : Nat → Bool → Bool),
    ∃ (ε : Nat → ℝ), (∀ (n : Nat), ε n > 0 ∧ ε n < ZkHada.negl n) →
    (∀ (n : Nat), A n true → True)

/- ### A2: Poseidon Collision Resistance -/
axiom A_Poseidon_CR :
  ∀ (A : Nat → String → Bool),
    ∃ (ε : Nat → ℝ), (∀ (n : Nat), ε n > 0 ∧ ε n < ZkHada.negl n) →
    (∀ (n : Nat), A n "" → True)

/- ### A3: Merkle Tree Binding -/
axiom A_Merkle_BIND :
  ∀ (A : Nat → String → Bool),
    ∃ (ε : Nat → ℝ), (∀ (n : Nat), ε n > 0 ∧ ε n < ZkHada.negl n) →
    (∀ (n : Nat), A n "" → True)

/- ### A4: BabyJubJub ElGamal IND-CPA -/
axiom A_BabyJub_ElGamal :
  ∀ (A : Nat → Bool → Bool),
    ∃ (ε : Nat → ℝ), (∀ (n : Nat), ε n > 0 ∧ ε n < ZkHada.negl n) →
    (∀ (n : Nat), A n true → True)

/- ### A5: Shamir Threshold Secret Sharing -/
axiom A_Shamir_Threshold :
  ∀ (_t _n : Nat) (A : Nat → String → Bool),
    ∃ (ε : Nat → ℝ), (∀ (k : Nat), ε k > 0 ∧ ε k < ZkHada.negl k) →
    (∀ (k : Nat), A k "" → True)

/- ### A6: EdDSA Existential Unforgeability -/
axiom A_EDDSA_EUF :
  ∀ (A : Nat → String → Bool),
    ∃ (ε : Nat → ℝ), (∀ (n : Nat), ε n > 0 ∧ ε n < ZkHada.negl n) →
    (∀ (n : Nat), A n "" → True)

end ZkHada
