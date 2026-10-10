/-
T7 audit (AUDIT_PLAN.md L2–L5). Checked against an UNMODIFIED copy of ZK-HADA `mechanization/` (commit 7966d60).
Run from mech_copy/:  lake env lean ../Audit.lean
TNFF.lean does not build (L1), so the TNFF checks use an extract: its game body `Gnff_body` ignores every oracle argument and is
`PMF.pure false`, so the extract keeps the body verbatim and drops only the (undefined) oracle parameters.
-/
import ZkHada.Basic
import ZkHada.CryptoAssumptions
import ZkHada.TANON

open ZkHada
namespace Audit

/-! ## L2: every advantage function is the constant 0 (definitional) -/
example (s : SecurityParameter) : Adv_Groth16_ZK s = 0 := rfl
example (s : SecurityParameter) : Adv_Groth16_KS s = 0 := rfl
example (s : SecurityParameter) : Adv_Poseidon_CR s = 0 := rfl
example (s : SecurityParameter) : Adv_Merkle_BIND s = 0 := rfl
example (s : SecurityParameter) : Adv_BabyJub_ElGamal s = 0 := rfl
example (s : SecurityParameter) : Adv_Shamir_Threshold s = 0 := rfl
example (s : SecurityParameter) : Adv_EDDSA_EUF s = 0 := rfl
example (d L : ℝ) (s : SecurityParameter) : Adv_Grobner d L s = 0 := rfl

/-! ## L3: every axiom of CryptoAssumptions.lean is provable WITHOUT axioms (its conclusion is `True`), so it assumes nothing -/
theorem A_Groth16_ZK_provable : ∀ (A : Nat → Bool → Bool), ∃ (ε : Nat → ℝ),
    (∀ (n : Nat), ε n > 0 ∧ ε n < ZkHada.negl n) → (∀ (n : Nat), A n true → True) :=
  fun _ => ⟨fun _ => 0, fun _ _ _ => trivial⟩
theorem A_Poseidon_CR_provable : ∀ (A : Nat → String → Bool), ∃ (ε : Nat → ℝ),
    (∀ (n : Nat), ε n > 0 ∧ ε n < ZkHada.negl n) → (∀ (n : Nat), A n "" → True) :=
  fun _ => ⟨fun _ => 0, fun _ _ _ => trivial⟩
theorem A_Merkle_BIND_provable : ∀ (A : Nat → String → Bool), ∃ (ε : Nat → ℝ),
    (∀ (n : Nat), ε n > 0 ∧ ε n < ZkHada.negl n) → (∀ (n : Nat), A n "" → True) :=
  fun _ => ⟨fun _ => 0, fun _ _ _ => trivial⟩
theorem A_BabyJub_ElGamal_provable : ∀ (A : Nat → Bool → Bool), ∃ (ε : Nat → ℝ),
    (∀ (n : Nat), ε n > 0 ∧ ε n < ZkHada.negl n) → (∀ (n : Nat), A n true → True) :=
  fun _ => ⟨fun _ => 0, fun _ _ _ => trivial⟩
theorem A_Shamir_Threshold_provable : ∀ (_t _n : Nat) (A : Nat → String → Bool), ∃ (ε : Nat → ℝ),
    (∀ (k : Nat), ε k > 0 ∧ ε k < ZkHada.negl k) → (∀ (k : Nat), A k "" → True) :=
  fun _ _ _ => ⟨fun _ => 0, fun _ _ _ => trivial⟩
theorem A_EDDSA_EUF_provable : ∀ (A : Nat → String → Bool), ∃ (ε : Nat → ℝ),
    (∀ (n : Nat), ε n > 0 ∧ ε n < ZkHada.negl n) → (∀ (n : Nat), A n "" → True) :=
  fun _ => ⟨fun _ => 0, fun _ _ _ => trivial⟩

/-! ## L5 (TANON): the games are constants; the "anonymity" theorem holds for ANY probability, and the defined advantage is 1/4 -/
theorem tanon_adv_is_one_quarter : Adv TANON.G0_PrWin = 1/4 := by
  unfold Adv TANON.G0_PrWin; norm_num [abs_of_pos]
theorem adv_le_half_for_every_probability (p : ℝ) (h0 : 0 ≤ p) (h1 : p ≤ 1) : Adv p ≤ 1/2 := by
  unfold Adv; rw [abs_le]; constructor <;> linarith
/-- Read as a security statement, an advantage of 1/4 is NOT negligible: already at λ = 3, negl λ = 1/8 < 1/4. -/
theorem tanon_adv_not_negligible : ¬ (Adv TANON.G0_PrWin ≤ negl 3) := by
  rw [tanon_adv_is_one_quarter]; unfold negl; norm_num

/-! ## L4 (TNFF extract): the axiom `H4_ideal` contradicts the definition of H4 -/
noncomputable def Gnff_body_x (_A : PPT_Adversary) (_s : SecurityParameter) : PMF Bool := PMF.pure false
noncomputable def H0x : CryptoGame := fun A s => Gnff_body_x A s
noncomputable def H4x : CryptoGame := fun A s => Gnff_body_x A s
def someA : PPT_Adversary := ⟨fun _ => 0, fun _ => 0, fun _ => 0⟩

theorem body_PrWin_zero (A : PPT_Adversary) (s : SecurityParameter) : PrWin H4x A s = 0 := by
  unfold PrWin H4x Gnff_body_x; simp

/-- TNFF.lean's `axiom H4_ideal : ∀ A s, PrWin H4 A s = 1/2` (with H4 as defined there) proves False. -/
theorem H4_ideal_inconsistent (H4_ideal : ∀ (A : PPT_Adversary) (s : SecurityParameter), PrWin H4x A s = 1/2) : False := by
  have h := H4_ideal someA 0
  rw [body_PrWin_zero] at h
  norm_num at h

/-- The STATEMENT of TNFF_main is false for the game H0 as defined (Adv = 1/2, every Adv_* = 0, negl 2 = 1/4),
    so the file could only "prove" it through the inconsistent axiom. -/
theorem TNFF_main_statement_false : ¬ (∀ (A : PPT_Adversary) (s : SecurityParameter),
    Adv (PrWin H0x A s) ≤ Adv_BabyJub_ElGamal s + Adv_Shamir_Threshold s + (D_max : ℝ) * Adv_EDDSA_EUF s + negl s) := by
  intro h
  have h2 := h someA 2
  have hz : PrWin H0x someA 2 = 0 := by unfold PrWin H0x Gnff_body_x; simp
  rw [hz] at h2
  unfold Adv Adv_BabyJub_ElGamal Adv_Shamir_Threshold Adv_EDDSA_EUF negl at h2
  norm_num at h2

/-- TNFF.lean's `T_poseidon_conditional` (2 × sorry) is provable without sorry, because both sides are built from the constant 0. -/
theorem T_poseidon_conditional_without_sorry (d L : ℕ) (s : SecurityParameter) :
    Adv_Poseidon_CR s ≤ Adv_Grobner (d : ℝ) (L : ℝ) s + negl s := by
  unfold Adv_Poseidon_CR Adv_Grobner; simpa using negl_nonneg s

end Audit

/-! ## `#print axioms` of every theorem that builds -/
#print axioms ZkHada.negl_pos
#print axioms ZkHada.IdealGame_PrWin
#print axioms ZkHada.TANON.G0_to_G1_bound
#print axioms ZkHada.TANON.G1_to_G2_bound
#print axioms ZkHada.TANON.main
#print axioms Audit.A_Groth16_ZK_provable
#print axioms Audit.H4_ideal_inconsistent
#print axioms Audit.TNFF_main_statement_false
#print axioms Audit.T_poseidon_conditional_without_sorry
