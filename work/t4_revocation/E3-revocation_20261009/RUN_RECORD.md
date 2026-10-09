# Run record: E3-revocation
- Date / operator(agent): 2026-10-09 / Claude (party B session)
- Issue / PR: #6 (T4), #18; branch `t4-e3-revocation` (from main 2eeac99)
- Source commit (zk-hada-exp): pre-registration 907c23b; code + results in the commit that adds this file. Historical commit: not used.
- Environment: macOS 26.4, Apple M5 Pro (15 cores), node 24.14.1, circom 2.2.3, snarkjs 0.7.6, circomlibjs 0.1.7, poseidon-lite 0.3.0 (from
  `../../t2_circuit_fix/zkdac_v7/node_modules`), forge 1.5.1 (solc 0.8.28, cancun). v7 mode C wasm from `../../t2_circuit_fix/zkdac_v7/build`.
- Command(s) (verbatim, in this directory unless stated):
  ```
  cd ablation && circom main_c_d4_leafonly.circom --r1cs --wasm -l ../../../t2_circuit_fix/zkdac_v7/circuits -l ../../../t2_circuit_fix/zkdac_v7/node_modules \
     -l ../../../t2_circuit_fix/zkdac_v7/node_modules/circomlib/circuits -l ../../../t2_circuit_fix/zkdac_v7/node_modules/@zk-kit/binary-merkle-root.circom/src -o build
  node e31_world.mjs  > results/e31_world.json  2> results/e31_world.stderr
  node e32_e33.mjs    > results/e32_e33.json    2> results/e32_e33.stderr
  node e34_leakage.mjs > results/e34_leakage.json 2> results/e34_leakage.stderr
  node e35_sim.mjs    > results/e35_sim.json
  cd ../../t4_contracts/foundry && forge test --match-contract E3WindowTest -vv > ../../t4_revocation/E3-revocation_20261009/results/forge_e35.txt
  ```
  Full forge suite after adding `t4_contracts/foundry/test/E3Window.t.sol`: 132/132 (125 existing + 7 new).
- Ablation build (not committed): r1cs sha256 732a2f74c1f4cd1697ea368940c1f1ba3cbf89b41a619bd986cf147b99a32f3e, wasm sha256
  cf681262904ab280964b7c61ab6b7f8efec0c5bf60bb407a47c736415c34eab0 (117,722 wires). Diff vs v7: `ablation/leafonly.diff`.
- Inputs + seeds: node keys = sha256("e3-node-" + name); decoys sha256("e3-decoy-k"); instance seeds 100 + holder index (world), 900 (A6); accSeed
  "e3-" + chain. E3.2/E3.3 entries: crypto.randomBytes (not recorded; the metrics are distributional). E3.5 sim: fixed xorshift128+ seed in the script.
- Outputs: `results/*` (sha256 in MANIFEST.sha256). `e31_world.stderr` contains snarkjs messages for every expected rejection (wasm assert errors).
- Results: RESULTS.md.
- Failures / anomalies / deviations: RESULTS.md "Deviations". Crashed runs' stderr kept.
- Claims supported / not supported: RESULTS.md "Verdict" and "Limits".
