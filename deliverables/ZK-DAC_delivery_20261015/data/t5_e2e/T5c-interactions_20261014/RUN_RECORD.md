# T5c — run record (I1, I3)
## I1
- Mac M5 Pro, node v24.14.1, anvil 1.5.1. Creds cache `build/creds.json`: the deterministic T5 tree, sha256 c5bf1100ea99c205…
- Smoke runs (not evidence):
  - Mac r10-d0, 12 epochs: the first attempt hung on the 60M gas limit (fixed by A1); the second passed.
  - RTX6000 r10-d1, 12 epochs: stopped when the run moved to the Mac (A3).
- Full run: `bash run_mac.sh 6`, 2026-10-14 13:30:42–15:02:30 UTC; 36 / 36 exit 0 (`results/run_status.txt`).
- Statistics: `python3 analyze_i1.py > results/stats.json` (numpy).
## I3
- Variant build:
  - `circom` compile of `zkdac_v9_2_noacc` c1..c4;
  - `scripts/setup_zkeys.sh` (Hermez ptau 2^18, one local contribution; the first attempt failed because the worktree had no ptau link, and was rerun);
  - verifiers copied to `foundry/src/variants/`; `forge build`.
- Gas: `node i3_gas.mjs > results/i3/gas.json`. Attempt 1 is kept in `results/i3/attempt1_cold_target/`.
- Proving: the paired loop in `results/i3/bench_log.txt` (`prove_bench.mjs 10` of v9.2 and noacc, order on, off, on, off), 13:10–13:16 UTC.
  - The Mac ran no other project computation. The "busy_node" count of 3 is idle ssh polling shells whose command line contains a script name.
- Mutation smoke: `node scripts/mutation_smoke.mjs > results/i3/mutation_smoke.json`.
## I2 (added 2026-10-15 after audit #79)
- **Smoke runs (Mac, not evidence):** f8-k8 and f32-k128. The f32-k128 run needed 4 blocks with a 3M gas limit; its output was not kept. That led to amendment A1.
- **Server.** Worktree `~/projects/zk-hada-exp-i2` at ef51d60 (amendment A1); node_modules and builds symlinked from the main clone. Server smoke f32-k128: 3 blocks.
- **Full run.** `nohup bash run_i2.sh 8`, 2026-10-15 04:16:56–05:21:58 UTC, 36 / 36 exit 0. Ports 8700–8735 were checked free beforehand.
- **Statistics.** `python3 analyze_i2.py > results/i2/stats.json` (Mac, after copying `results/i2`).
