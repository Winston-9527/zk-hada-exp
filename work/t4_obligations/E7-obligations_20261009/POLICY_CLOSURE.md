# T3 v7 POLICY rows → the contract test that closes each (issue #18)
The 18 FALSE_ACCEPT rows of `../../t3_attacks/v7/results/attacks_v7.json` are accepted by the circuit alone by design; each is an obligation of the gate.
"forge" = `../../t4_contracts/foundry/test/<file>`; "receipts" = `results/e2e_v7r.json` (5 client runs).
| T3 row(s) | What the circuit accepts | Closed by | Evidence |
|---|---|---|---|
| A10 | replay of a spent nullifier | nullifier set, set before the business call (CEI) | V7.t.sol `test_replay_rejected`; ObligationsV7 G2 (retry after a business revert succeeds once, then NullifierSpent), G3 (re-entrant replay); receipts `execute_1_replay_forced`: status 0, NullifierSpent, all 5 clients |
| A11a × 7 | same public inputs, executed with another chainId / gate / method / amount / params / nonce / target | ctx_hash computed by the contract from the actual call | ObligationsV7 G4 × 7 (InvalidProof) |
| A11-req | prover-chosen req_cap | requiredCap[method] supplied by the contract | ObligationsV7 G5 |
| A12c × 3, A18e | proof against the pre-revocation revoked root | revoked-root window Δ | RevokeV7R `test_gate_revokedByIssuer_windowThenRejected` (authorized revocation, accepted at t0 + Δ, StaleRevokedRoot at t0 + Δ + 1); E3Window.t.sol on PR #34 (Δ ∈ {0, 12, 60, 240, 3600}); receipts `execute_2_after_window_forced`: status 0, StaleRevokedRoot, all 5 clients |
| A14 | now = 0 (clock lie) | clock check `ts − skew ≤ now ≤ ts` | ObligationsV7 G1 (4 boundaries) |
| A17c' | proof against the pre-replacement root_root | registry root window | V6.t.sol `test_replacedMaster_oldProofAfterWindow_rejected` (same ZkDacRegistry contract, unchanged since v6) |
| A18d | master key ent[1] revoked as a key entry | masters are replaced by re-registration, not key entries | V6.t.sol `test_replacedMaster_*` (A17c) |
| A19b (A, C) | ciphertexts to a prover-chosen key with public tpk = that key | TPK fixed in the gate at deployment | V7.t.sol `test_otherAuditorKey_rejected` |
All 18 rows have a closing contract test on the v7 gate or on a contract the v7 gate uses unchanged.
