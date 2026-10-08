# T3 on v7 (v6 + R6 accountability in the action proof, #30) — mapping, committed BEFORE running (issues #5 / #30)
Classes: `../ATTACKS_PREREGISTRATION.md`; v6 mapping `../v6/ATTACKS_PREREGISTRATION_v6.md`. v7 encrypts all chain keys ent[0..D] to the auditor key TPK
(public input, fixed by the gate contract) with fresh per-action randomness; ciphertexts are public inputs. Two modes: A (per-key ElGamal) and C (ElGamal-
encapsulated ephemeral point K + Poseidon keystream). Main candidate: C (fewer constraints and less gas, measured before this file was written).

Oracle `oracle_v7.mjs` = `../v6/oracle_v6.mjs` + accountability rule: tpk == world.tpk, and decrypting the public ciphertexts with the auditor secret
(world.tsk) yields exactly (ent[0], ..., ent[D]) in order. Keystream recomputed with poseidon-lite (independent of circomlibjs); ElGamal decryption with
circomlibjs babyJub (shared with the generator; disclosed).

All v6 rows (A00–A18) are re-run unchanged on v7 mode-C instances (D = 4 unless stated). New rows, run in BOTH modes (A and C), D = 4:
| ID | Attack | Expected |
|---|---|---|
| A19a | "wrong accountability object": ciphertext of ent[j] replaced by a correct encryption of another (attacker / innocent) key, j = 0, 1, D | reject |
| A19b | ciphertexts encrypted to a prover-chosen key; public tpk = prover's key while the verifier uses the committee key | reject (statement: tpk ≠ committee key) |
| A19b' | same, but the proof's public tpk is set to the committee key | reject |
| A19c | ciphertexts copied from another chain's valid action | reject |
| A19d | ciphertexts copied from an earlier action of the SAME chain (same randomness) | accept (valid encryption; links the prover's own actions — privacy cost borne by the prover, accountability unaffected) |
| A19e | two key ciphertexts swapped (order of ent[] in the opening) | reject |
| A19f | randomness r ≥ 2^251 (r + subgroup order alias) | reject (witness) |
| A19g | mode C: ephemeral point K off the curve | reject |
| A19h | mode C: K = identity (0, 1) — keystream key public to everyone | accept (accountability unaffected; privacy loss for the prover only) |
| A19i | committee key TPK = identity (0, 1) configured in the gate: ciphertexts reveal the keys in clear | **POLICY** (circuit accepts; deployment must check TPK is a prime-order subgroup point ≠ identity) |
| A19j | single ciphertext word +1 (each word position, statement level) | reject |
Pass criterion: zero FALSE_ACCEPT outside POLICY rows; COMPLETENESS_GAP 0; the auditor recovers ent[0..D] on every accepted row. Exhaustive oracle diff (D=4,
both modes) and T2 single-field mutation re-run.
