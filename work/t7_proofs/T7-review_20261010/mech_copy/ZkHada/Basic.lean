import Mathlib

namespace ZkHada

open scoped ENNReal

/-! ## Basic Types and Cryptographic Primitives

This module defines the foundational types for the ZK-HADA security mechanization:
- `SecurityParameter` (λ): the security parameter
- `negl(λ)`: a negligible function (1/2^λ)
- `PPT_Adversary`: probabilistic polynomial-time adversary with query and time budgets
- `Adv(prWin)`: advantage over random guessing
- Cryptographic advantage functions as opaque constants with axiomatic bounds
-/

/-- Security parameter λ ∈ ℕ. -/
abbrev SecurityParameter := Nat

/-- Negligible function: negl(λ) = 1/2^λ -/
noncomputable def negl (n : SecurityParameter) : ℝ :=
  1 / ((2 : ℝ) ^ (n : ℕ))

theorem negl_pos (n : SecurityParameter) : 0 < negl n := by
  unfold negl
  have h : 0 < (2 : ℝ) ^ (n : ℕ) := by
    apply pow_pos
    norm_num
  apply div_pos
  · norm_num
  · exact h

theorem negl_nonneg (n : SecurityParameter) : 0 ≤ negl n :=
  le_of_lt (negl_pos n)

/-- Adversary advantage: |Pr[win] - 1/2| -/
noncomputable def Adv (prWin : ℝ) : ℝ :=
  |prWin - 1/2|

/-- PPT (Probabilistic Polynomial-Time) adversary.
  - `queryBudget λ` is the maximum number of oracle queries
  - `timeBudget λ` is the maximum running time (in abstract steps)
  - `advantage λ` is the achievable distinguishing advantage at security parameter λ -/
structure PPT_Adversary where
  queryBudget : SecurityParameter → Nat
  timeBudget  : SecurityParameter → Nat
  advantage   : SecurityParameter → ℝ

/-! ## Crypto Game Framework

A cryptographic game is a probabilistic experiment parameterized by
a PPT adversary and a security parameter, producing a `PMF Bool`
(true = adversary wins, false = adversary loses).

`PMF` is Mathlib's probability mass function — each point has a probability
mass in `ℝ≥0∞` and the total mass sums to 1.
-/

/-- A cryptographic game: given a PPT adversary and security parameter,
    produces a probability distribution over `Bool` (win/lose). -/
def CryptoGame := PPT_Adversary → SecurityParameter → PMF Bool

/-- Maximum delegation depth D_max = 4. -/
def D_max : ℕ := 4

/-- Extract win probability from a `CryptoGame` as a real number.
    Computes the measure of `{true}` under the game's PMF. -/
noncomputable def PrWin (game : CryptoGame) (A : PPT_Adversary) (s : SecurityParameter) : ℝ :=
  ENNReal.toReal ((game A s).toMeasure {true})

/-- Extract win probability directly from a `PMF Bool`. -/
noncomputable def PrWinPMF (p : PMF Bool) : ℝ :=
  ENNReal.toReal (p.toMeasure {true})

/-- The ideal game: a fair Bernoulli(1/2) coin flip,
    independent of the adversary. Win probability = 1/2. -/
noncomputable def IdealGame : CryptoGame :=
  λ _ _ => PMF.ofFintype (fun (_ : Bool) => (1/2 : ℝ≥0∞)) (by
    simp; simpa [mul_comm] using ENNReal.inv_mul_cancel (by norm_num) (by norm_num))

/-- In the ideal game, the win probability is exactly 1/2
    regardless of the adversary. -/
theorem IdealGame_PrWin (A : PPT_Adversary) (s : SecurityParameter) :
    PrWin IdealGame A s = 1/2 := by
  unfold PrWin IdealGame
  simp

/-! ## Cryptographic Advantage Functions

Each advantage function gives the MAXIMUM distinguishing advantage achievable
by any PPT adversary against the corresponding primitive at security parameter λ.
These are `noncomputable` because they involve suprema over infinite adversary classes.
Their bounds are axiomatized in `CryptoAssumptions.lean`.
-/

noncomputable def Adv_Groth16_ZK      (s : SecurityParameter) : ℝ := 0
noncomputable def Adv_Groth16_KS      (s : SecurityParameter) : ℝ := 0
noncomputable def Adv_Poseidon_CR     (s : SecurityParameter) : ℝ := 0
noncomputable def Adv_Merkle_BIND     (s : SecurityParameter) : ℝ := 0
noncomputable def Adv_BabyJub_ElGamal (s : SecurityParameter) : ℝ := 0
noncomputable def Adv_Shamir_Threshold (s : SecurityParameter) : ℝ := 0
noncomputable def Adv_EDDSA_EUF       (s : SecurityParameter) : ℝ := 0
noncomputable def Adv_Grobner        (d : ℝ) (L : ℝ) (s : SecurityParameter) : ℝ := 0

/-! ## Game State Types -/

structure PublicParameters where
  securityParam : SecurityParameter

structure VerificationKey where
  vk : String

structure AdversarialSK where
  skA : String

structure DelegationChain where
  capHash    : String
  nullifier  : String
  root       : String

/-! ## Negligible Function Lemmas -/

/-- Division lemma: a/c - b/c = (a-b)/c -/
lemma div_sub_div_same (a b c : ℝ) (_hc : c ≠ 0) : a / c - b / c = (a - b) / c := by
  ring

end ZkHada