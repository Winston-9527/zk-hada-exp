# T7b — Lean state-machine invariants of the budget gate and revocation — results
Plan with fixed theorem statements: `PLAN.md` (24eadcc, committed before any Lean). Model and proofs: `BudgetSM.lean`; non-vacuity checks: `Sanity.lean`.
Build: `lake build` exit 0 (`build.log`). Axioms: `lake env lean Check.lean` (`check_output.txt`), `lake env lean Sanity.lean` (`sanity_output.txt`).
Lean v4.31.0-rc2, mathlib 261b5e31 (the T7 revision).

## Verdict
**All four pre-registered theorems are machine-checked, with no `sorry` and no axiom beyond Lean's standard ones** (propext, Classical.choice,
Quot.sound). The statements are unchanged from PLAN.md.

| theorem | statement (for every reachable state / every execution) |
|---|---|
| T1 `T1_conservation`, `T1_used_le_minted` | unspent mass + total spent by actions = total minted; hence spent ≤ minted |
| T2 `T2_subtree_conservation`, `T2_usedUnder_le_inflow` | for every certificate entry c: unspent below c + spent below c = minted into c + delegated into c. **All agents below an edge together never spend more than was put into it.** This is H3: per-edge caps let siblings spend 200 / 100 (H3 pre-study); the note gate cannot |
| T3 `T3_revocation_monotone` | a recorded revocation is never removed or changed by any transaction; time never decreases |
| T4 `T4_freeze` | once now > t + Δ for an entry revoked at t, **nothing below it is ever spent again** along any later execution |

**Non-vacuity** (`Sanity.lean`, standard axioms only):
- a concrete legal trace mint 100 → delegate 40 → spend 10 is reachable, and its counters are as expected (used 10, usedUnder 2 = 10, inflow 2 = 40);
- the same model **without the budget-nullifier check** reaches used = 200 > minted = 100.

So T1 depends on that gate check and is not true by construction.

## What is and is not mechanized
- **Mechanized:** the gate as a transition system. The transitions are mint, split, delegate (child entry appended), execute (spend + change note),
  revoke (once, with time), and tick. The guards are input note exists and unspent, amounts conserve in ℕ, and every input-lineage entry is
  unrevoked or inside the window Δ. Old note roots inside the gate's window are covered, because notes are never removed: membership in an old root
  implies membership now. The double spend is stopped by the spent flag, not by the root.
- **Not mechanized; stated assumptions** (PLAN.md):
  - K: Groth16 knowledge soundness turns an accepted proof into the guard;
  - B: commitment binding;
  - N: the budget nullifier is deterministic and injective on notes.

    Under B and N, the per-index spent flag over-approximates the real nullifier set, so every real execution is a model execution and the
    invariants carry over. This refinement argument is on paper, not in Lean.
  - E: a delegated entry is new to the lineage (slot-indexed edge hash + Poseidon CR);
  - ℕ amounts stand for the circuit's 64-bit range checks.
- **Omitted, safe by over-approximation:** key revocation and expiry. They only remove executions. Without them, the model's revocation guard
  covers certificate entries only.
- **Observed in the model, not a defect:** delegating into an already-revoked child entry is possible (budget_transfer checks the input lineage, not
  the new child certificate). The value is then frozen (T4) — the parent loses it; nothing is spent.
- **Not covered:** concurrency is the EVM's (one transaction at a time, atomic), as in E2. Nothing cryptographic or probabilistic is mechanized.

## Relation to the old `mechanization/` (T7, LEAN_AUDIT.md)
This is a new, separate development. It does not repair TANON / TNFF and makes no claim about anonymity or no-false-framing. For the paper, the
supported wording is:

> "budget conservation, subtree conservation and revocation monotonicity / freeze are machine-checked in Lean for a state-machine model of the gate,
> under stated cryptographic abstraction assumptions."
