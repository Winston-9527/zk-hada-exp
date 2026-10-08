# T3 re-run on v4 (layout C + IMT revocation, depth 20) — issue #5
Date 2026-10-08. Env as ../v3/RESULTS_v3.md; machine Apple M5 Pro. Mapping addendum `ATTACKS_PREREGISTRATION_v4.md` committed and pushed (4d9b558) before any v4 attack ran.
Run: `node v4/attacks_v4.mjs > v4/results/attacks_v4.json`; `node v4/exhaustive_diff_v4.mjs 4 > v4/results/exhaustive_diff_v4_d4.json`.
Oracle: ../v3/oracle_v3.mjs (set semantics), with the IMT root as the current revocation root.

## Summary (D=4; A02b also D=1..3) — 81 cases
AGREE_REJECT 55, AGREE_ACCEPT 9, BAD_WITNESS_ONLY 4, FALSE_ACCEPT 13, **COMPLETENESS_GAP 0**.
- **All 13 FALSE_ACCEPT are pre-registered POLICY rows** (contract obligations, closed in #18): A10 replay; A11a ×7 (executed action ≠ proved action — this time
  pre-registered as POLICY; closed by VariantC `test_A11a_*` + `test_amountSubstitutionRejected`); A11-req (prover-chosen req_cap = 0); A12c ×3 (stale revocation root);
  A14 (`now` = 0).
- **No statement-level false accept.** Revocation under IMT, for certs 0 / 1 / 3: old witness vs new root, predecessor leaf, forged skip leaf rejected; the generator
  finds no witness for a revoked key (A12a). A13 (revoked cert among keys sharing 17 / 40 / 200 low bits): predecessor, successor, two-below and end-of-list leaves all rejected.
- **A13b resolved:** an honest certificate with three revoked keys sharing 17 / 40 / 200 low bits is accepted by circuit and oracle (was COMPLETENESS_GAP under SMT RD=16).

## Harness fix (transparent)
Run 1 (`v4/results/attacks_v4_run1.json`) silently skipped the pre-registered A13c (end-of-list leaf) and the A13 successor rows: the revoked certificate happened to be
the largest key, so it had no successor and the end-of-list leaf was its own leaf. Fixed by adding one revoked key above all certificate keys, and the script now throws
instead of skipping when a pre-registered row cannot be exercised. No outcome changed; the added rows are all AGREE_REJECT.

## Oracle sanity (v4/results/exhaustive_diff_v4_d4.json)
337 single-field mutations: the only statement-level disagreement is `now` (+1: circuit accepts, oracle with a trusted clock rejects). All other disagreements are
witness-only fields (m_sib, m_bit, r_sib, r_bit, r_low_*), by design.

## Claims
Circuit + contract jointly: no false accept once the contract enforces roots, clock, nullifier set, ctx_hash and req_cap. Revocation is sound and complete for
up to 2^20 revocations under the IMT; the earlier SMT liveness gap is closed. Witness level only (proof-level checks: ../../t2_circuit_fix/zkdac_v4 proofs).
