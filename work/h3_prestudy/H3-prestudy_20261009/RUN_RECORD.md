# Run record: H3-prestudy
- Date / operator(agent): 2026-10-09 / Claude (party B session). Issues #11, #16. Branch `h3-prestudy` from main cd18d8e. Pre-registration 0d00fdf.
- Environment: macOS 26.4, Apple M5 Pro (15 cores), node 24.14.1, circom 2.2.3, snarkjs 0.7.6, poseidon-lite 0.3.0, @zk-kit/lean-imt (zkdac_v7 node_modules),
  forge 1.5.1 (solc 0.8.28, cancun). ptau Hermez 2^18; note zkey = one local phase-2 contribution (not a trusted setup).
- Near-neighbour check: zkm.dev/spec (v0.1.0-draft, 2026-08-04) and zkm.dev/faq read 2026-10-09 (summarised in PREREGISTRATION.md §N).
- Commands (in this directory):
  ```
  node model.mjs > results/model.json
  circom circuits/note_transfer.circom --r1cs --wasm --sym -l ../../t2_circuit_fix/zkdac_v7/circuits -l ../../t2_circuit_fix/zkdac_v7/node_modules \
     -l ../../t2_circuit_fix/zkdac_v7/node_modules/circomlib/circuits -l ../../t2_circuit_fix/zkdac_v7/node_modules/@zk-kit/binary-merkle-root.circom/src -o build
  ./setup_zkey.sh
  node cases.mjs > results/cases.json 2> results/cases.stderr
  node bench.mjs 10 > results/bench.json 2> results/bench.stderr     # also writes t4_contracts/foundry/test/fixtures_h3note.json
  cp zk/Groth16VerifierNote.sol ../../t4_contracts/foundry/src/
  cd ../../t4_contracts/foundry && forge test --match-contract H3NoteTest -vv > ../../h3_prestudy/H3-prestudy_20261009/results/forge_h3note.txt
  ```
  Full forge suite after adding H3Note.t.sol: see results/forge_h3note.txt and the PR (162/162 expected = 159 + 3).
- Seeds: model xorshift seed in model.mjs; keys/rho = sha256 labels in note_lib.mjs ("h3-key-*", "h3-rho-*").
- Contracts added (prototype, not protocol): `t4_contracts/foundry/src/{H3NoteGatePrototype,Groth16VerifierNote}.sol`, test `test/H3Note.t.sol`.
- Results, deviations, risks: RESULTS.md.
