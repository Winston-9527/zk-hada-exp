# T3 re-run on v5 (v4 + registered-root tree, #17 option b) — issues #5 / #17
Date 2026-10-08. Mapping addendum `ATTACKS_PREREGISTRATION_v5.md` committed and pushed (5da7b4f) before any v5 attack ran.
Run: `node v5/attacks_v5.mjs > v5/results/attacks_v5.json`; `node v5/exhaustive_diff_v5.mjs 4 > v5/results/exhaustive_diff_v5_d4.json`. Oracle: `v5/oracle_v5.mjs`.

## Summary (D=4; A02b also D=1..3) — 87 cases
AGREE_REJECT 59, AGREE_ACCEPT 9, BAD_WITNESS_ONLY 5, FALSE_ACCEPT 14, COMPLETENESS_GAP 0.
- All 14 FALSE_ACCEPT are pre-registered POLICY rows: the 13 of v4 (A10, A11a ×7, A11-req, A12c ×3, A14) + **A17c'** (replaced master, proof against the
  pre-replacement root_root — closed by the registry's root window: V5Test `test_replacedMaster_oldProofAfterWindow_rejected`).
- New A17 rows: cert0 never registered (A17a), replaced master vs new root (A17c), rt_depth > RT with root 0 (A17d), root certificate registered for another
  master (A17e) — rejected; another registered leaf's path (A17b) — rejected, classified BAD_WITNESS_ONLY (cert0 is registered; a valid path exists).
- A05 (splice) on v5 registers A's root certificate in B's root tree first, so it tests the splice itself: rejected.

## Harness fixes (transparent)
Run 1 (`v5/results/attacks_v5_run1.json`) reported COMPLETENESS_GAP ×2 caused by my harness, not by the circuit (circuit outcomes identical in both runs):
A17b lacked `validWitnessExists: true`; A17d modelled the registry's current root as 0 (the attacker targets the real registry, whose root is not 0).

## Oracle sanity (v5/results/exhaustive_diff_v5_d4.json)
360 single-field mutations: only statement-level disagreement is `now` (+1). All others are witness-only fields (m_*, r_*, rt_depth / rt_index / rt_sib).
