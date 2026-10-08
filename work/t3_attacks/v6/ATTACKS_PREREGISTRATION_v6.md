# T3 re-run on v6 (v5 + holder-key revocation, #28) — mapping, committed BEFORE running (issues #5 / #28)
Classes: `../ATTACKS_PREREGISTRATION.md`; v5 mapping `../v5/ATTACKS_PREREGISTRATION_v5.md`. v6 adds key entries H(KEY_TAG = "zkrk", Ax, Ay) to the
same revocation IMT (same public revoked_root); the circuit proves non-membership for the delegate keys ent[2..D]. ent[1] (master) is deliberately
not checked in the circuit: a master is invalidated by re-registration (registry replaces leaf0, #17 / A17c).

Oracle `oracle_v6.mjs` = `../v5/oracle_v5.mjs` + rule "H(KEY_TAG, ent[j]) ∉ world.revokedKeys for **every j = 1..D**" (the semantics the user decided:
a revoked agent key is dead in every certificate). The oracle therefore deliberately checks ent[1] too, so the master-key case shows up as a
pre-registered POLICY row instead of being hidden by matching the oracle to the circuit. Key entries use poseidon-lite (independent of circomlibjs).

All v5 rows (A00–A17, incl. POLICY rows A10, A11a, A11-req, A12c, A14, A17c') are re-run unchanged on v6 instances. New rows (D=4 unless stated):
| ID | Attack | Expected |
|---|---|---|
| A18a | terminal key ent[D] revoked after the witness was built: old key witness vs new root (D = 2, 3, 4) | reject |
| A18a' | same: honest re-proof (generator must find no witness) | no witness |
| A18b | **key compromise**: intermediate key ent[2] revoked; holder of that key signs a fresh certificate to a fresh attacker key, and the fresh certificate is even registered in the delegation tree; attacker proves with the new chain | reject |
| A18c | key ent[j] revoked (j = 2, 3, 4): predecessor leaf / forged leaf skipping the key / end-of-list leaf | reject |
| A18d | master key ent[1] revoked as a key entry; chain otherwise valid | **POLICY** (circuit accepts by design; closed by re-registration, A17c) |
| A18e | proof against the pre-revocation revoked_root after ent[3] was revoked | POLICY (contract root window, as A12c) |
| A18f | liveness: 3 revoked keys whose key hashes share 17 / 40 / 200 low bits with H(ent[3]); revoked keys of unrelated agents | accept |
| A18g | key revoked under a non-canonical encoding (Poseidon(2)(Ax, Ay), or tag 0) — not a revocation of the key | accept (operator must use the canonical encoding) |
| A18h | key witnesses of slots ent[2] and ent[3] swapped (nothing revoked) | reject (BAD_WITNESS_ONLY) |
| A18i | revoked key reused as ent[j] at a different position j' (revoked as ent[2], appears as ent[4] in another chain) | reject |
Pass criterion: zero FALSE_ACCEPT outside POLICY rows; COMPLETENESS_GAP 0. Exhaustive oracle diff (D=4) re-run; T2 single-field mutation re-run.
