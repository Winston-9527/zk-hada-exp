# Run record: v6 action proofs behind the unchanged v5 gate — issue #28 (holder-key revocation)
Date 2026-10-08. Env as RUN_RECORD_v5.md (Apple M5 Pro; forge 1.5.1, solc 0.8.28, cancun, optimizer 200; node 24.14.1, snarkjs 0.7.6).
Verifier `src/Groth16VerifierV6D2.sol` = `../t2_circuit_fix/zkdac_v6/zk/Groth16VerifierV6D2.sol` (zkey on the Hermez 2^18 ptau, one local phase-2 contribution).
Fixtures: `node gen_fixtures_v6.mjs` (needs ../t2_circuit_fix/zkdac_v6 and ../t4_registration builds + zkeys) → foundry/test/fixtures_V6.json.
Tests: `cd foundry && forge test --match-contract V6Test -vv`; full suite 113/113 (96 before + 17 V6Test).

## What changed on-chain
Nothing. Key entries live in the same revocation IMT as certificate entries, so the public inputs (7) and `ZkDacGateV5` are unchanged; the gate is
deployed with the v6 verifier. The revoked root is still set by the operator (`updateRoots`); **who may ask for a key entry** (the key holder by a
signature with that key, or a parent) is an operator / contract policy that is not implemented yet (see #28).

## Results (foundry/test/V6.t.sol, real proofs, D = 2: the terminal key ent[2] is checked)
17/17: all 14 V5Test cases re-run with v6 proofs (registry history A→M1, B, A→M2 in place) pass, plus:
- `test_keyRevoked_oldProofWithinWindow_POLICY`: the operator revokes B's terminal key K_B (revoked root rv0 → rv1); B's proof made against rv0 is still
  accepted inside the revoked-root window (POLICY: revocation lag = window, as for certificate revocation).
- `test_keyRevoked_oldProofAfterWindow_rejected`: after the window, StaleRevokedRoot.
- `test_keyRevoked_othersProveAgainstNewRoot`: A proves against rv1 (which holds K_B) and executes.
- The fixture generator also checks that no witness exists for B once K_B is in the tree ("no witness for B once K_B is revoked").
rv0 and rv1 are separate instance trees (each fixture instance builds its own revocation tree); the gate only compares roots, so this does not affect
the tests.

## Gas (forge gasleft; results/forge_gas_v6.txt)
| operation | v5 | v6 |
|---|---|---|
| verifyProof (7 public inputs, incl. ctxHash) | 236,395 | 236,395 |
| execute #1 (excl. intrinsic) | 318,707 | 318,707 |
| register #1 / #2 / re-register | 342,170 / 360,368 / 345,874 | unchanged (same registry) |
Groth16 verification cost depends on the number of public inputs, not on the circuit size, so holder-key revocation is free on-chain.
