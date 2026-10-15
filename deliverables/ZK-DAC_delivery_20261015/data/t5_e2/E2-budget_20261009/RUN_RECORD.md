# Run record: E2-budget (#39)
Date 2026-10-09. anvil 1.5.1 (`--hardfork prague --chain-id 31337 --gas-limit 300000000`, port 8553, anvil test key #0 — public, local only), ethers 5.7.2,
snarkjs 0.7.6, node 24.14.1, Apple M5 Pro. Command: `node e2_anvil.mjs > results/e2_anvil.json 2> results/e2_anvil.stderr`.
Races use `evm_setAutomine false` → send all → `evm_mine`; every race landed in one block (blocks 28, 34, 37, 38). Revert reasons from debug_traceTransaction.
Windows: revoked 30 s, note root 600 s, clock skew 3600 s (proofs carry the start time). Proofs are generated during the run on the mirrored state; the
mirror note root is checked against gate8.noteRoot() after every operation.
Run 1 failed at deployment (PoseidonT3 not linked into ZkDacGateV8; stderr kept as results/e2_anvil_run1_link_failed.stderr). Run 2 = results/e2_anvil.json.
Results: ../../t2_circuit_fix/zkdac_v8/RESULTS.md §E2.
