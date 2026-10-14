# T8c — run record
- A: the loop in `results/bench_log.txt` (Mac, `scripts/prove_bench.mjs 10` in `zkdac_v9_1` and `zkdac_v9_2` of the main clone), 12:26:06–12:32:40 UTC.
- B: document audit by a subagent (reads only), written to `TIMING_SOURCE_AUDIT.md`.
- C: `c/run_c_env2.sh` on RTX6000 (worktree `~/projects/zk-hada-exp-t8c` at f103c32), 13:19–14:36 UTC, nice 19.
  - The Mac side: `node c/c5_gen.mjs 1000 10 > results/c5_proofs_mac.json` (before C, committed in f103c32).
  - `node c/c5_verify.mjs results/c/c5_proofs_env2.json > results/c5_verify_env2_on_mac.json`.
  - The release zkeys downloaded on env 2 are not copied back; their sha256 check is in `results/c/release_check.txt`.
