# Run record: T5b (2026-10-12, Apple M5 Pro, node 24.14.1, snarkjs 0.7.6). Pre-registration e579d62. From this directory:
```
node latency_ci.mjs > results/latency_p95_ci.json
node revoke_circuit.mjs > results/revoke_circuit.json 2> results/revoke_circuit.stderr     # 3 min 56 s
```
Reads ../T5-e2e-scale_20261010/state (final world) and results read-only; v9 wasm from zkdac_v9/build, v9.1 wasm from zkdac_v9_1/build. Control sample seed "t5b-controls".
