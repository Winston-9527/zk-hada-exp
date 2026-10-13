/-
T7c R1a (PLAN.md): an executable transition function `exec` over T7b's state `St` (BudgetSM.lean, copied byte-identical), and the machine-checked
soundness lemma `exec_sound`: every state `exec` produces is a `Step` of T7b's model, so the T1-T4 invariants hold along every `exec` run.
The differential test (diff.mjs) compares the real contracts against `exec`, step by step.
-/
import BudgetSM

namespace BudgetSM

inductive Op where
  | mint (q : ℕ) (lin : List ℕ)
  | split (i q1 q2 : ℕ)
  | delegate (i c q1 q2 : ℕ)
  | execute (i qs qc : ℕ)
  | revoke (c : ℕ)
  | tick

/-- Boolean version of `live` (every lineage entry unrevoked, or revoked at t with now ≤ t + Δ). -/
def liveB (Δ : ℕ) (s : St) (l : List ℕ) : Bool :=
  l.all (fun c => match s.revokedAt c with
    | none => true
    | some t => decide (s.now ≤ t + Δ))

lemma liveB_live {Δ : ℕ} {s : St} {l : List ℕ} (h : liveB Δ s l = true) : live Δ s l := by
  intro c hc t ht
  have hall := List.all_eq_true.mp h c hc
  simp only [ht, decide_eq_true_eq] at hall
  exact hall

def exec (Δ : ℕ) (s : St) : Op → Option St
  | .mint q lin =>
      some { (s.ins ⟨q, lin⟩) with minted := s.minted + q,
                                    inflow := fun d => if d ∈ lin then s.inflow d + q else s.inflow d }
  | .split i q1 q2 =>
      if (i < s.size ∧ s.spent i = false) ∧ q1 + q2 = (s.note i).q ∧ liveB Δ s (s.note i).lin = true then
        some (((s.spend i).ins ⟨q1, (s.note i).lin⟩).ins ⟨q2, (s.note i).lin⟩)
      else none
  | .delegate i c q1 q2 =>
      if (i < s.size ∧ s.spent i = false) ∧ q1 + q2 = (s.note i).q ∧ liveB Δ s (s.note i).lin = true ∧ c ∉ (s.note i).lin then
        some { (((s.spend i).ins ⟨q1, (s.note i).lin ++ [c]⟩).ins ⟨q2, (s.note i).lin⟩) with
               inflow := fun d => if d = c then s.inflow d + q1 else s.inflow d }
      else none
  | .execute i qs qc =>
      if (i < s.size ∧ s.spent i = false) ∧ qs + qc = (s.note i).q ∧ liveB Δ s (s.note i).lin = true then
        some { ((s.spend i).ins ⟨qc, (s.note i).lin⟩) with
               used := s.used + qs,
               usedUnder := fun d => if d ∈ (s.note i).lin then s.usedUnder d + qs else s.usedUnder d }
      else none
  | .revoke c =>
      some { s with revokedAt := fun d => if d = c ∧ s.revokedAt c = none then some s.now else s.revokedAt d }
  | .tick => some { s with now := s.now + 1 }

/-- Soundness of the executable model: `exec` only takes steps of the relational model `Step`. -/
theorem exec_sound (Δ : ℕ) (s s' : St) (op : Op) (h : exec Δ s op = some s') : Step Δ s s' := by
  cases op with
  | mint q lin =>
    simp only [exec, Option.some.injEq] at h
    subst h
    exact Step.mint s ⟨q, lin⟩
  | split i q1 q2 =>
    simp only [exec] at h
    split at h
    · rename_i hc
      simp only [Option.some.injEq] at h
      subst h
      exact Step.split s i q1 q2 hc.1 hc.2.1 (liveB_live hc.2.2)
    · exact absurd h (by simp)
  | delegate i c q1 q2 =>
    simp only [exec] at h
    split at h
    · rename_i hc
      simp only [Option.some.injEq] at h
      subst h
      exact Step.delegate s i c q1 q2 hc.1 hc.2.1 (liveB_live hc.2.2.1) hc.2.2.2
    · exact absurd h (by simp)
  | execute i qs qc =>
    simp only [exec] at h
    split at h
    · rename_i hc
      simp only [Option.some.injEq] at h
      subst h
      exact Step.execute s i qs qc hc.1 hc.2.1 (liveB_live hc.2.2)
    · exact absurd h (by simp)
  | revoke c =>
    simp only [exec, Option.some.injEq] at h
    subst h
    exact Step.revoke s c
  | tick =>
    simp only [exec, Option.some.injEq] at h
    subst h
    exact Step.tick s

/-- Runs of `exec` from a reachable state stay reachable. -/
theorem exec_fold_reachable (Δ : ℕ) : ∀ (ops : List Op) (s0 s : St), Reachable Δ s0 → ops.foldlM (exec Δ) s0 = some s → Reachable Δ s
  | [], s0, s, h0, h => by
    simp only [List.foldlM_nil] at h
    cases h
    exact h0
  | op :: ops, s0, s, h0, h => by
    simp only [List.foldlM_cons] at h
    cases he : exec Δ s0 op with
    | none => simp [he] at h
    | some s1 =>
      simp only [he, Option.bind_eq_bind, Option.bind_some] at h
      exact exec_fold_reachable Δ ops s1 s (Relation.ReflTransGen.tail h0 (exec_sound Δ s0 s1 op he)) h

/-- Runs of `exec` from `init` are reachable states of `Step`, so T1-T4 apply to them. -/
theorem exec_run_reachable (Δ : ℕ) (ops : List Op) (s : St) (h : ops.foldlM (exec Δ) init = some s) : Reachable Δ s :=
  exec_fold_reachable Δ ops init s Relation.ReflTransGen.refl h

/-- The conservation theorem specialised to `exec` runs. -/
theorem exec_run_conservation (Δ : ℕ) (ops : List Op) (s : St) (h : ops.foldlM (exec Δ) init = some s) :
    mass s (fun _ => true) + s.used = s.minted :=
  T1_conservation Δ (exec_run_reachable Δ ops s h)

end BudgetSM
