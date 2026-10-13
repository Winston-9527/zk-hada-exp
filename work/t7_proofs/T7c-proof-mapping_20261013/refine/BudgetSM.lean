/-
T7b (PLAN.md): state-machine model of the v9 budget gate (ZkDacGateV9: mint / transferBudget / execute + budget-nullifier set) and of
ZkDacRevocations (monotonic revoked set, window Δ). Cryptography is abstracted by the assumptions K, B, N, E of PLAN.md (not mechanized).
Theorems: T1 conservation, T2 subtree conservation (H3), T3 monotonic revocation, T4 freeze after the window.
-/
import Mathlib

namespace BudgetSM
open Finset

/-- A budget note: amount and lineage (the certificate entries of its chain). -/
structure Note where
  q   : ℕ
  lin : List ℕ

/-- Gate state. `note`/`spent` model the append-only note tree and the budget-nullifier set (one flag per inserted note);
`used`, `usedUnder`, `inflow` are ghost counters; `revokedAt c = some t` means entry c was revoked at time t. -/
structure St where
  size      : ℕ
  note      : ℕ → Note
  spent     : ℕ → Bool
  minted    : ℕ
  used      : ℕ
  usedUnder : ℕ → ℕ
  inflow    : ℕ → ℕ
  revokedAt : ℕ → Option ℕ
  now       : ℕ

def init : St := ⟨0, fun _ => ⟨0, []⟩, fun _ => false, 0, 0, fun _ => 0, fun _ => 0, fun _ => none, 0⟩

/-- insert a fresh unspent note (LeanIMT insert) -/
def St.ins (s : St) (n : Note) : St :=
  { s with size := s.size + 1, note := fun j => if j = s.size then n else s.note j, spent := fun j => if j = s.size then false else s.spent j }

/-- mark note i spent (budget nullifier recorded) -/
def St.spend (s : St) (i : ℕ) : St :=
  { s with spent := fun j => if j = i then true else s.spent j }

/-- revoked-root window: every lineage entry is unrevoked, or revoked at t with now ≤ t + Δ -/
def live (Δ : ℕ) (s : St) (l : List ℕ) : Prop := ∀ c ∈ l, ∀ t, s.revokedAt c = some t → s.now ≤ t + Δ

def avail (s : St) (i : ℕ) : Prop := i < s.size ∧ s.spent i = false

/-- One gate transaction (atomic). -/
inductive Step (Δ : ℕ) : St → St → Prop
  | mint (s : St) (n : Note) :
      Step Δ s { (s.ins n) with minted := s.minted + n.q, inflow := fun d => if d ∈ n.lin then s.inflow d + n.q else s.inflow d }
  | split (s : St) (i q1 q2 : ℕ) (ha : avail s i) (hq : q1 + q2 = (s.note i).q) (hl : live Δ s (s.note i).lin) :
      Step Δ s (((s.spend i).ins ⟨q1, (s.note i).lin⟩).ins ⟨q2, (s.note i).lin⟩)
  | delegate (s : St) (i c q1 q2 : ℕ) (ha : avail s i) (hq : q1 + q2 = (s.note i).q) (hl : live Δ s (s.note i).lin)
      (hc : c ∉ (s.note i).lin) :
      Step Δ s { (((s.spend i).ins ⟨q1, (s.note i).lin ++ [c]⟩).ins ⟨q2, (s.note i).lin⟩) with
                 inflow := fun d => if d = c then s.inflow d + q1 else s.inflow d }
  | execute (s : St) (i qs qc : ℕ) (ha : avail s i) (hq : qs + qc = (s.note i).q) (hl : live Δ s (s.note i).lin) :
      Step Δ s { ((s.spend i).ins ⟨qc, (s.note i).lin⟩) with
                 used := s.used + qs, usedUnder := fun d => if d ∈ (s.note i).lin then s.usedUnder d + qs else s.usedUnder d }
  | revoke (s : St) (c : ℕ) :
      Step Δ s { s with revokedAt := fun d => if d = c ∧ s.revokedAt c = none then some s.now else s.revokedAt d }
  | tick (s : St) : Step Δ s { s with now := s.now + 1 }

def Reachable (Δ : ℕ) (s : St) : Prop := Relation.ReflTransGen (Step Δ) init s

/-! ## Unspent mass of the notes whose lineage satisfies P -/
def term (s : St) (P : List ℕ → Bool) (j : ℕ) : ℕ :=
  if s.spent j = false ∧ P (s.note j).lin = true then (s.note j).q else 0

def mass (s : St) (P : List ℕ → Bool) : ℕ := ∑ j ∈ range s.size, term s P j

lemma mass_ins (s : St) (n : Note) (P : List ℕ → Bool) :
    mass (s.ins n) P = mass s P + (if P n.lin = true then n.q else 0) := by
  unfold mass
  have hsz : (s.ins n).size = s.size + 1 := rfl
  rw [hsz, sum_range_succ]
  congr 1
  · apply sum_congr rfl
    intro j hj
    have hne : j ≠ s.size := Nat.ne_of_lt (mem_range.mp hj)
    simp [term, St.ins, hne]
  · simp [term, St.ins]

lemma mass_spend (s : St) (i : ℕ) (ha : avail s i) (P : List ℕ → Bool) :
    mass s P = mass (s.spend i) P + (if P (s.note i).lin = true then (s.note i).q else 0) := by
  unfold mass
  have hi : i ∈ range s.size := mem_range.mpr ha.1
  have hsz : (s.spend i).size = s.size := rfl
  rw [hsz, ← add_sum_erase _ _ hi, ← add_sum_erase _ (term (s.spend i) P) hi]
  have h1 : term s P i = (if P (s.note i).lin = true then (s.note i).q else 0) := by
    simp [term, ha.2]
  have h2 : term (s.spend i) P i = 0 := by simp [term, St.spend]
  have h3 : ∑ x ∈ (range s.size).erase i, term s P x = ∑ x ∈ (range s.size).erase i, term (s.spend i) P x := by
    apply sum_congr rfl
    intro j hj
    have hne : j ≠ i := ne_of_mem_erase hj
    simp [term, St.spend, hne]
  rw [h1, h2, h3]; ring

/-! ## T1 conservation -/
def Inv1 (s : St) : Prop := mass s (fun _ => true) + s.used = s.minted

lemma inv1_step (Δ : ℕ) {s s' : St} (h : Step Δ s s') (hs : Inv1 s) : Inv1 s' := by
  unfold Inv1 at *
  cases h with
  | mint n =>
    have hm : mass { (s.ins n) with minted := s.minted + n.q, inflow := fun d => if d ∈ n.lin then s.inflow d + n.q else s.inflow d } (fun _ => true)
            = mass (s.ins n) (fun _ => true) := rfl
    rw [hm, mass_ins]; simp only [ite_true]
    show mass s (fun _ => true) + n.q + s.used = s.minted + n.q
    omega
  | split i q1 q2 ha hq hl =>
    rw [mass_ins, mass_ins, mass_spend s i ha] at *
    simp only [ite_true] at *
    show mass (s.spend i) (fun _ => true) + q1 + q2 + s.used = s.minted
    omega
  | delegate i c q1 q2 ha hq hl hc =>
    have hm : mass { (((s.spend i).ins ⟨q1, (s.note i).lin ++ [c]⟩).ins ⟨q2, (s.note i).lin⟩) with
                     inflow := fun d => if d = c then s.inflow d + q1 else s.inflow d } (fun _ => true)
            = mass (((s.spend i).ins ⟨q1, (s.note i).lin ++ [c]⟩).ins ⟨q2, (s.note i).lin⟩) (fun _ => true) := rfl
    rw [hm, mass_ins, mass_ins, mass_spend s i ha] at *
    simp only [ite_true] at *
    show mass (s.spend i) (fun _ => true) + q1 + q2 + s.used = s.minted
    omega
  | execute i qs qc ha hq hl =>
    have hm : mass { ((s.spend i).ins ⟨qc, (s.note i).lin⟩) with
                     used := s.used + qs, usedUnder := fun d => if d ∈ (s.note i).lin then s.usedUnder d + qs else s.usedUnder d } (fun _ => true)
            = mass ((s.spend i).ins ⟨qc, (s.note i).lin⟩) (fun _ => true) := rfl
    rw [hm, mass_ins, mass_spend s i ha] at *
    simp only [ite_true] at *
    show mass (s.spend i) (fun _ => true) + qc + (s.used + qs) = s.minted
    omega
  | revoke c => exact hs
  | tick => exact hs

theorem T1_conservation (Δ : ℕ) {s : St} (h : Reachable Δ s) : mass s (fun _ => true) + s.used = s.minted := by
  induction h with
  | refl => simp [mass, init]
  | tail _ hstep ih => exact inv1_step Δ hstep ih

theorem T1_used_le_minted (Δ : ℕ) {s : St} (h : Reachable Δ s) : s.used ≤ s.minted := by
  have := T1_conservation Δ h; omega

/-! ## T2 subtree conservation (H3): below any entry c, unspent + spent = what flowed in -/
def under (c : ℕ) : List ℕ → Bool := fun l => decide (c ∈ l)

def Inv2 (c : ℕ) (s : St) : Prop := mass s (under c) + s.usedUnder c = s.inflow c

lemma inv2_step (Δ c : ℕ) {s s' : St} (h : Step Δ s s') (hs : Inv2 c s) : Inv2 c s' := by
  unfold Inv2 at *
  cases h with
  | mint n =>
    have hm : mass { (s.ins n) with minted := s.minted + n.q, inflow := fun d => if d ∈ n.lin then s.inflow d + n.q else s.inflow d } (under c)
            = mass (s.ins n) (under c) := rfl
    rw [hm, mass_ins]
    show _ + s.usedUnder c = (if c ∈ n.lin then s.inflow c + n.q else s.inflow c)
    by_cases hc : c ∈ n.lin <;> simp [under, hc] <;> omega
  | split i q1 q2 ha hq hl =>
    rw [mass_ins, mass_ins, mass_spend s i ha] at *
    show _ + s.usedUnder c = s.inflow c
    by_cases hc : c ∈ (s.note i).lin <;> simp [under, hc] at * <;> omega
  | delegate i c' q1 q2 ha hq hl hc' =>
    have hm : mass { (((s.spend i).ins ⟨q1, (s.note i).lin ++ [c']⟩).ins ⟨q2, (s.note i).lin⟩) with
                     inflow := fun d => if d = c' then s.inflow d + q1 else s.inflow d } (under c)
            = mass (((s.spend i).ins ⟨q1, (s.note i).lin ++ [c']⟩).ins ⟨q2, (s.note i).lin⟩) (under c) := rfl
    rw [hm, mass_ins, mass_ins, mass_spend s i ha] at *
    show _ + s.usedUnder c = (if c = c' then s.inflow c + q1 else s.inflow c)
    by_cases hcc : c = c'
    · subst hcc
      simp [under, hc'] at *
      omega
    · by_cases hc : c ∈ (s.note i).lin <;> simp [under, hc, hcc] at * <;> omega
  | execute i qs qc ha hq hl =>
    have hm : mass { ((s.spend i).ins ⟨qc, (s.note i).lin⟩) with
                     used := s.used + qs, usedUnder := fun d => if d ∈ (s.note i).lin then s.usedUnder d + qs else s.usedUnder d } (under c)
            = mass ((s.spend i).ins ⟨qc, (s.note i).lin⟩) (under c) := rfl
    rw [hm, mass_ins, mass_spend s i ha] at *
    show _ + (if c ∈ (s.note i).lin then s.usedUnder c + qs else s.usedUnder c) = s.inflow c
    by_cases hc : c ∈ (s.note i).lin <;> simp [under, hc] at * <;> omega
  | revoke d => exact hs
  | tick => exact hs

theorem T2_subtree_conservation (Δ : ℕ) {s : St} (h : Reachable Δ s) (c : ℕ) :
    mass s (under c) + s.usedUnder c = s.inflow c := by
  induction h with
  | refl => simp [mass, init]
  | tail _ hstep ih => exact inv2_step Δ c hstep ih

/-- All agents below entry c together never spend more than was minted or delegated into c. -/
theorem T2_usedUnder_le_inflow (Δ : ℕ) {s : St} (h : Reachable Δ s) (c : ℕ) : s.usedUnder c ≤ s.inflow c := by
  have := T2_subtree_conservation Δ h c; omega

/-! ## T3 monotonic revocation and time -/
theorem T3_revocation_monotone (Δ : ℕ) {s s' : St} (h : Step Δ s s') (c t : ℕ) (hr : s.revokedAt c = some t) :
    s'.revokedAt c = some t ∧ s.now ≤ s'.now := by
  cases h with
  | mint n => exact ⟨hr, le_refl _⟩
  | split i q1 q2 ha hq hl => exact ⟨hr, le_refl _⟩
  | delegate i c' q1 q2 ha hq hl hc => exact ⟨hr, le_refl _⟩
  | execute i qs qc ha hq hl => exact ⟨hr, le_refl _⟩
  | revoke d =>
    refine ⟨?_, le_refl _⟩
    show (if c = d ∧ s.revokedAt d = none then some s.now else s.revokedAt c) = some t
    by_cases hcd : c = d
    · subst hcd; simp [hr]
    · simp [hcd, hr]
  | tick => exact ⟨hr, Nat.le_succ _⟩

/-! ## T4 freeze: after the window, nothing below a revoked entry is spent, along any later execution -/
def Frozen (Δ c t u : ℕ) (s : St) : Prop := s.revokedAt c = some t ∧ t + Δ < s.now ∧ s.usedUnder c = u

lemma frozen_step (Δ c t u : ℕ) {s s' : St} (h : Step Δ s s') (hf : Frozen Δ c t u s) : Frozen Δ c t u s' := by
  obtain ⟨hr, hn, hu⟩ := hf
  obtain ⟨hr', hn'⟩ := T3_revocation_monotone Δ h c t hr
  refine ⟨hr', lt_of_lt_of_le hn hn', ?_⟩
  cases h with
  | mint n => exact hu
  | split i q1 q2 ha hq hl => exact hu
  | delegate i c' q1 q2 ha hq hl hc => exact hu
  | execute i qs qc ha hq hl =>
    show (if c ∈ (s.note i).lin then s.usedUnder c + qs else s.usedUnder c) = u
    by_cases hc : c ∈ (s.note i).lin
    · have := hl c hc t hr; omega
    · simp [hc, hu]
  | revoke d => exact hu
  | tick => exact hu

theorem T4_freeze (Δ : ℕ) {s s' : St} (h : Relation.ReflTransGen (Step Δ) s s') (c t : ℕ)
    (hr : s.revokedAt c = some t) (hw : t + Δ < s.now) : s'.usedUnder c = s.usedUnder c := by
  have key : Frozen Δ c t (s.usedUnder c) s' := by
    induction h with
    | refl => exact ⟨hr, hw, rfl⟩
    | tail _ hstep ih => exact frozen_step Δ c t _ hstep ih
  exact key.2.2

end BudgetSM
