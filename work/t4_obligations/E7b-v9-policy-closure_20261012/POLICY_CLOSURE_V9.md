# POLICY closure of T3 v9 / v9.1 on ZkDacGateV9 (audit #55)
Post hoc, written 2026-10-12 after audit #55. Earlier text claimed that every T3 v9 POLICY row was closed by `POLICY_CLOSURE.md` + `V9.t.sol`.
That claim was wrong: `../E7-obligations_20261009/POLICY_CLOSURE.md` covers the v7 gate only, and V9.t.sol closed 8 of the 20 rows.

- Tests: `work/t4_contracts/foundry/test/V9Policy.t.sol` (`V9PolicyTest`, extends `V9Test`). 22 tests were written by the audit (#55) and are added
  unchanged except for the contract name. `test_A21c_revokedRootRetired` was added by party B.
- Fixtures: `fixtures_V9.json` (real v9 proofs). The v9.1 gate is the same contract, and the v9.1 verifiers differ only in key constants
  (`../../t2_circuit_fix/zkdac_v9_1/results/verifier_diff.txt`).
- Runs: `forge_v9policy.txt` (34 / 34 pass) and `forge_all.txt` (whole suite, 215 / 215 pass). forge 1.5.1.

## Row → closing test (all on ZkDacGateV9)
| T3 row | closed by | revert |
|---|---|---|
| A10′ replay | `test_v9_replayOfExecutedProof`, `test_reentrantReplay` | BudgetSpent (see note 1) |
| A11a chainId / gate / method / params / nonce / target | `test_A11a_*` (control: `test_A11a_gateAddress_control` accepts) | InvalidProof |
| A11a amount | `test_A11a_amountOnly` / `test_A11a_amountAndQ` | AmountMismatch / InvalidProof |
| A11-req | `test_A11req` | InvalidProof |
| A12c × 3, A18e, A21c (stale revoked root) | `test_GB7_revocationFreezesBudget` (inside Δ accepted, after Δ rejected), `test_A21c_revokedRootRetired` | StaleRevokedRoot |
| A14 clock | `test_A14_skew60_tooOld`, `test_A14_skew60_future`, edge `test_A14_skew60_edge_ok` | BadClock (see note 2) |
| A17c′, A18d (retired / replaced registered root) | `test_A17c_registryRejects` (registry mocked to retire the root) | UnregisteredRootRoot |
| A20g amount ≠ q_spent | `test_GB2_amountMismatch` | AmountMismatch |
| A20h note root after window | `test_GB4_noteRootAfterWindow` | StaleNoteRoot |
| A22h other TPK | `test_A22h_otherTpk` | InvalidProof |
| stale issued root (not a T3 row) | `test_staleIssuedRoot` | StaleIssuedRoot |

**Notes**
1. The BudgetSpent check runs before proof verification, so `test_A10_selectorBeforeVerify` gets BudgetSpent even with a garbage proof. The replay
   tests show that the nullifier is hit; the fact that the replayed proof is valid comes from the first, accepted execution of the same proof.
2. `V9.t.sol` deploys with skew = 1e6 and NOW = 1000, so A14 passes the clock check in that configuration (`test_A14_now0_V9config` fails only at
   the verifier). With skew = 60, A14 is closed by BadClock. T5 and the receipts used SKEW = 3600.
3. A17c′ / A18d are closed through the registry's `rootAccepted`. The registry's own window and re-registration logic are tested in `V6.t.sol`.

## Disclosed, not fixed (no research-design goal depends on them)
- **Cross-gate replay of `transferBudget`.** The transfer proof binds neither chainid nor gate address, and transfer checks no clock, issued root or
  registry. It replays on a second gate only if that gate accepts the same note root, i.e. a copy of the same note tree. Deployments have
  separate trees.
- **Identity TPK at deployment.** The constructor does not check TPK; `test_A22i_identityTpkDeploys` shows this. A22i is a deployment check, done
  off chain.
- **Front-running.** msg.sender is not bound, so anyone can submit a pending proof (`test_frontRunnerCanSubmit`). The action executed is the
  bound one. This is bearer semantics, by design.
- **`updateIssuedRoot`** resets retiredAt, so the operator can re-activate an old issued root. The operator is trusted for issuance.
- **Code notes.** `ZkDacGateV9.sol:35` has a stale comment (nCt = D + 6), and `spent` / `NullifierSpent` are dead code. Left as they are.
