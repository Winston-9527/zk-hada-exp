# Run record: T7c (2026-10-13, Apple M5 Pro, node 24.14.1, circom 2.2.3, forge 1.5.1, Lean v4.31.0-rc2)
Plan pushed at ab9d535 before any test. All commands from this directory unless stated.
```bash
# harness circuits (build/ is git-ignored)
L7=../../t2_circuit_fix/zkdac_v7
circom tests/circuits/imt_nm4.circom --wasm --r1cs -l $L7/circuits -l $L7/node_modules -o build/imt
circom tests/circuits/poseidon_kat.circom --wasm --r1cs -l $L7/node_modules -o build/kat
cd tests
node x1_imt.mjs > ../results/x1_imt.json 2> ../results/x1_imt.stderr                       # 1 min 58 s
node x1c_contract_fixtures.mjs                                                              # -> ../../../t4_contracts/foundry/test/t7c_revoke_fixtures.json
node x2_poseidon.mjs > ../results/x2_poseidon.json 2> ../results/x2_poseidon.stderr         # also writes test/t7c_poseidon_kat.json (run twice: grep-check fix, see below)
node x3_x5_mutations.mjs > ../results/x3_x5.json 2> ../results/x3_x5.stderr                 # 15 s
node x4_committee.mjs > ../results/x4_committee.json
cd ../../../t4_contracts/foundry
forge test --match-contract T7cPoseidonKat -vv | grep -E "T7C|PASS|FAIL" > ../../t7_proofs/T7c-proof-mapping_20261013/results/x2_solidity.txt
forge test --match-contract T7cRevocations -vv | grep -E "T7C|PASS|FAIL" > ../../t7_proofs/T7c-proof-mapping_20261013/results/x1c_contract.txt
cd ../../t7_proofs/T7c-proof-mapping_20261013/refine        # .lake/packages -> ../../T7b-lean-statemachine_20261010/.lake/packages (symlink, not committed)
lake build && lake env lean Check.lean > check_output.txt
MODE=mock N=1000 SEED=r1-mock PORT=8571 node diff.mjs > ../results/r1_mock.json 2> ../results/r1_mock.stderr     # 469 s
MODE=real N=50  SEED=r1-real PORT=8572 node diff.mjs > ../results/r1_real.json 2> ../results/r1_real.stderr      # 694 s (parallel with the mock run)
```
Development runs and fixes (outputs kept where they exist):
- x2: the grep self-check first counted `Poseidon(7)` inside a source comment and parsed a line list wrongly (9 vs 7, 9 vs 8). The fix: strip comments, parse the numbers. The inventory itself was unchanged. Known answers were identical in both runs.
- x2 forge: per-item JSON reads ran out of EVM memory, so the KAT file uses flat arrays (one read each).
- R1 first full run: hung on ethers `waitForTransaction` (killed); the second run had two real-mode harness bugs (`results/*_run1*`, see RESULTS.md). The reported runs used the fixed harness; the mock results are identical before and after.
- R1 smoke runs (5, 30 and 3 sequences, SEED smoke / smoke2 / dbg) are not reported.
