# Run record: registry contract + v5 gate with real proofs — issue #17 (option b)
Date 2026-10-08. Env: Apple M5 Pro; forge 1.5.1 (solc 0.8.28, cancun, optimizer 200), forge-std v1.17.0, **@zk-kit/lean-imt.sol 2.0.1**,
**poseidon-solidity 0.0.5** (PoseidonT3, public library, linked by forge); node 24.14.1, snarkjs 0.7.6, @zk-kit/lean-imt 2.2.5 (JS).
Install: `npm ci` in t4_contracts; forge-std as in RUN_RECORD.md; `ln -sfn ../../node_modules/@zk-kit/lean-imt.sol foundry/lib/zk-kit-lean-imt`
(forge drops the "/" after a remapping target ending in ".sol", so the package is reached through this symlink; foundry/lib is not committed).
Fixtures: `node gen_fixtures_v5.mjs` (needs ../t2_circuit_fix/zkdac_v5 and ../t4_registration builds + zkeys) → foundry/test/fixtures_V5.json.
Tests: `cd foundry && forge test --match-contract V5Test -vv`; full suite 96/96.

## Contracts
- `src/ZkDacRegistry.sol`: verifies the registration proof (Groth16VerifierRegister, public group_root, domain, nf, leaf0) for an accepted Semaphore group root;
  nf → current leaf0; first registration = LeanIMT insert, re-registration = in-place LeanIMT update (siblings supplied by the caller, checked against the current
  root by InternalLeanIMT); replaced leaves are marked `retired` and can never be registered again; root history with acceptance window; root 0 never accepted.
  Trust: only the choice of accepted Semaphore group roots (the personhood source) is an operator decision.
- `src/ZkDacGateV5.sol`: ZkDacGateC's obligations + `registry.rootAccepted(root_root)`; 7 public inputs. Separate contract (logic copied) so that the bytecode/gas of
  the earlier gates stays as measured in PR #19/#20.

## Finding fixed during design
Registration proofs are public calldata. Without `retired`, after A replaces master M1 by M2 anyone could resubmit A's OLD proof and roll A back to M1
(a re-registration path). `test_oldRegistrationReplayAfterReplacement_rejected` covers it.

## Results (foundry/test/V5.t.sol, real proofs; history A→M1 (R1), B (R2), A→M2 in-place (R3))
14/14: on-chain LeanIMT roots equal the JS LeanIMT after each step (R1, R2, R3), old leaf gone, leaf retired, nf → new leaf; act after registration;
act without registration rejected (UnregisteredRootRoot); new master acts; other human unaffected; replaced master's old proof accepted inside the root window
(POLICY: revocation lag = window) and rejected after it; registration replay rejected; old-registration replay after replacement rejected (LeafRetired);
unknown group root rejected; registration for another domain rejected (InvalidProof); replacement with wrong siblings rejected and root unchanged; action replay rejected.

## Gas (forge gasleft, fixture parsing outside the windows; results/forge_gas_v5.txt)
| operation | gas |
|---|---|
| register #1 (insert into empty tree) | 342,170 |
| register #2 (insert) | 360,368 |
| re-register (in-place update) | 345,874 |
| registration verifyProof alone (4 public inputs) | 213,219 |
| v5 verifyProof (7 public inputs, incl. ctxHash) | 236,395 |
| v5 execute #1 (excl. intrinsic) | 318,707 |
Registration is a one-off per human per domain (and per master replacement). The v5 action cost stays at the layout-C level (v4: 319,296) despite the extra public
input and the registry call. Real-transaction (anvil/geth) receipts for v5 are not measured yet.
