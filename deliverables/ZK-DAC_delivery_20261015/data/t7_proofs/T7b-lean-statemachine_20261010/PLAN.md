# T7b — Lean state-machine invariants (research design line 160; user decision 2026-10-10) — plan (committed BEFORE writing any Lean)
Goal: machine-check the NON-cryptographic part of budget conservation (H3, research design Q2) and of revocation (Q3) on a model of the v9 gate
(`ZkDacGateV9`: mint / transferBudget / execute, budget nullifier set) and of `ZkDacRevocations` (monotonic revoked set, window Δ).
Cryptography is abstracted by explicit, stated assumptions; nothing probabilistic is mechanized.

## Model
- Notes are values (q : ℕ, lin : List ℕ of certificate entries), stored in an append-only array (index = insertion order, as the LeanIMT).
  A per-index `spent` flag models the budget-nullifier set.
- Transitions, each atomic like an EVM transaction:
  - mint (operator; any lineage);
  - split (q1 + q2 = q_in, same lineage);
  - delegate (child entry c ∉ lin appended to out1; out2 keeps lin);
  - execute (q_spent + q_change = q_in);
  - revoke c (records the time once; never removed);
  - tick (time + 1).
- Guards (the gate + circuit relation), for split / delegate / execute:
  - the input note exists and is unspent;
  - amounts conserve (ℕ, i.e. range-checked);
  - every entry of the input lineage is either unrevoked or revoked at t with now ≤ t + Δ (the revoked-root window).
- Ghost state: `used` (total spent by actions), `usedUnder c` (actions whose note lineage contains c), `inflow c` (amount minted with c in the lineage
  plus amount delegated into c).

## Abstraction assumptions (stated, NOT mechanized)
- K: Groth16 knowledge soundness — an accepted proof implies the relation for some witness (the guards above).
- B: commitment binding — a commitment opens to one note.
- N: budget_nf = H(TAG, sk, cm) is injective on notes and deterministic. The per-index flag over-approximates the real nullifier set (duplicate
  commitments are spendable once in reality and once per index in the model), so the model allows a superset of real executions.
- E: c ∉ lin for a delegated entry — edge hashes include the slot index (domain separation) + Poseidon CR.
- Key revocation and expiry are omitted. They only remove executions, so the invariants still hold.

## Theorems to prove (statements fixed here)
- T1 conservation: reachable s → unspent s + used s = minted s; corollary used ≤ minted.
- T2 subtree conservation (the H3 property): reachable s → ∀ c, unspentUnder s c + usedUnder s c = inflow s c; corollary usedUnder c ≤ inflow c.
  This is "all agents below an edge together never spend more than was delegated into it".
- T3 monotonic revocation: step s s' → revokedAt s c = some t → revokedAt s' c = some t; and now s ≤ now s'.
- T4 freeze: s →* s', revokedAt s c = some t, t + Δ < now s → usedUnder s' c = usedUnder s c (no spending below a revoked edge after the window, along
  any later execution).
Toolchain: Lean v4.31.0-rc2 + the mathlib already fetched for T7 (same revision). Success = `lake build` with no `sorry`, and `#print axioms` showing
only propext / Classical.choice / Quot.sound for T1–T4. Failure to prove any statement is reported, not hidden; statements are not weakened silently
(any change is listed as a deviation).
