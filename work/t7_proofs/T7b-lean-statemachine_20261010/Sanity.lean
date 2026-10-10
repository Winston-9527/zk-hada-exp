/- T7b non-vacuity checks (added after T1–T4 built; see RESULTS.md):
   (1) a concrete trace exists that mints, delegates and spends, so the guards are satisfiable and the theorems are not about an empty set;
   (2) dropping the nullifier (spent-flag) guard makes `used ≤ minted` false: the conservation theorem depends on that gate check. -/
import BudgetSM
namespace BudgetSM.Sanity
open BudgetSM

def s1 : St := { (init.ins ⟨100, [1]⟩) with minted := init.minted + 100, inflow := fun d => if d ∈ [1] then init.inflow d + 100 else init.inflow d }
def s2 : St := { (((s1.spend 0).ins ⟨40, (s1.note 0).lin ++ [2]⟩).ins ⟨60, (s1.note 0).lin⟩) with inflow := fun d => if d = 2 then s1.inflow d + 40 else s1.inflow d }
def s3 : St := { ((s2.spend 1).ins ⟨30, (s2.note 1).lin⟩) with used := s2.used + 10, usedUnder := fun d => if d ∈ (s2.note 1).lin then s2.usedUnder d + 10 else s2.usedUnder d }

theorem trace_reachable : Reachable 30 s3 := by
  have h1 : Step 30 init s1 := Step.mint init ⟨100, [1]⟩
  have h2 : Step 30 s1 s2 := Step.delegate s1 0 2 40 60 (by simp [avail, s1, St.ins, init]) (by simp [s1, St.ins, init])
      (by intro c hc t ht; simp [s1, St.ins, init] at ht) (by simp [s1, St.ins, init])
  have h3 : Step 30 s2 s3 := Step.execute s2 1 10 30 (by simp [avail, s2, s1, St.ins, St.spend, init]) (by simp [s2, s1, St.ins, St.spend, init])
      (by intro c hc t ht; simp [s2, s1, St.ins, St.spend, init] at ht)
  exact Relation.ReflTransGen.tail (Relation.ReflTransGen.tail (Relation.ReflTransGen.tail Relation.ReflTransGen.refl h1) h2) h3

theorem trace_values : s3.used = 10 ∧ s3.usedUnder 2 = 10 ∧ s3.inflow 2 = 40 ∧ s3.minted = 100 := by
  simp [s3, s2, s1, St.ins, St.spend, init]

/-- The gate WITHOUT the budget-nullifier check (input only has to exist). -/
inductive StepNoNf : St → St → Prop
  | mint (s : St) (n : Note) : StepNoNf s { (s.ins n) with minted := s.minted + n.q }
  | execute (s : St) (i qs qc : ℕ) (hi : i < s.size) (hq : qs + qc = (s.note i).q) :
      StepNoNf s { ((s.spend i).ins ⟨qc, (s.note i).lin⟩) with used := s.used + qs }

def m1 : St := { (init.ins ⟨100, [1]⟩) with minted := init.minted + 100 }
def m2 : St := { ((m1.spend 0).ins ⟨0, (m1.note 0).lin⟩) with used := m1.used + 100 }
def m3 : St := { ((m2.spend 0).ins ⟨0, (m2.note 0).lin⟩) with used := m2.used + 100 }

theorem double_spend_without_nullifier :
    Relation.ReflTransGen StepNoNf init m3 ∧ ¬ (m3.used ≤ m3.minted) := by
  refine ⟨?_, ?_⟩
  · have h1 : StepNoNf init m1 := StepNoNf.mint init ⟨100, [1]⟩
    have h2 : StepNoNf m1 m2 := StepNoNf.execute m1 0 100 0 (by simp [m1, St.ins, init]) (by simp [m1, St.ins, init])
    have h3 : StepNoNf m2 m3 := StepNoNf.execute m2 0 100 0 (by simp [m2, m1, St.ins, St.spend, init]) (by simp [m2, m1, St.ins, St.spend, init])
    exact Relation.ReflTransGen.tail (Relation.ReflTransGen.tail (Relation.ReflTransGen.tail Relation.ReflTransGen.refl h1) h2) h3
  · simp [m3, m2, m1, St.ins, St.spend, init]

end BudgetSM.Sanity

#print axioms BudgetSM.Sanity.trace_reachable
#print axioms BudgetSM.Sanity.trace_values
#print axioms BudgetSM.Sanity.double_spend_without_nullifier
