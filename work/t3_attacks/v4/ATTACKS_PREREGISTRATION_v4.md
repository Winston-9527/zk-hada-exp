# T3 re-run on v4 (layout C + indexed Merkle tree revocation) — mapping, committed BEFORE running (issue #5)
Attack classes: `../ATTACKS_PREREGISTRATION.md` (v2). v3 mapping: `../v3/ATTACKS_PREREGISTRATION_v3.md`. This addendum maps them to v4, where the per-hop
revocation check is an IMT non-membership proof (depth 20; key = low 252 bits of the certificate hash) instead of a circomlib SMT exclusion proof.
Oracle: `../v3/oracle_v3.mjs` unchanged (revocation is a set of certificate hashes; the 252-bit truncation can only differ from the set semantics on a
2^-252-probability collision, which this run does not attempt to construct).

Changes relative to the v3 mapping:
| ID | v3 | v4 form | expected |
|---|---|---|---|
| A11a | was pre-registered as plain "reject" (wrong) | proof for action X, verifier executes action Y | **POLICY** (circuit accepts; contract computes ctx_hash; closed by VariantC tests) |
| A12a | honest re-proof after revoking cert i (SMT: key found) | IMT: no low leaf exists for a member; generator must fail to produce a witness | no witness |
| A12b | old SMT exclusion proof vs new root | old IMT witness vs new root | reject |
| A12b' | — | **new:** predecessor leaf of the revoked key in the new tree | reject |
| A12b'' | — | **new:** forged low leaf skipping the revoked key, with the predecessor's old path | reject |
| A12c | proof against stale pre-revocation root | same | POLICY (contract root window) |
| A13 | forged SMT exclusion with oldKey sharing RD+1 low bits | IMT: revoked cert whose key shares 17 / 40 / 200 low bits with other revoked keys; attempt with neighbour leaves | reject |
| A13b | honest cert sharing 17 low bits with 2 revoked keys: COMPLETENESS_GAP under SMT RD=16 | same scenario, plus 40 and 200 shared bits | **accept** (gap expected to be closed) |
| A13c | — | **new:** end-of-list leaf (next_value = 0) used for a revoked key below the maximum | reject |
All other rows (A00, A02–A10, A11b, A11-req, A14–A16) are unchanged from the v3 mapping.
Pass criterion: zero FALSE_ACCEPT outside POLICY rows, and no COMPLETENESS_GAP. Also re-run the exhaustive oracle-vs-circuit diff (D=4).
