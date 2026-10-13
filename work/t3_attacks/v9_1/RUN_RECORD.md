# Run record: T3 v9.1 (2026-10-12, Apple M5 Pro, node 24.14.1). Mapping 8b82adf. From work/t3_attacks:
```
node v9_1/attacks_v9_1.mjs > v9_1/results/attacks_v9_1.json 2> v9_1/results/attacks_v9_1.stderr       # 1 min 15 s
node v9_1/exhaustive_diff_v9_1.mjs 4 > v9_1/results/exhaustive_diff_v9_1_d4.json 2> v9_1/results/exhaustive_diff_v9_1_d4.stderr   # 2 min 5 s
```
Needs ../t2_circuit_fix/zkdac_v9_1/build (wasm, zkey) and ../t2_circuit_fix/zkdac_v9/build (reference rows A24-v9).
