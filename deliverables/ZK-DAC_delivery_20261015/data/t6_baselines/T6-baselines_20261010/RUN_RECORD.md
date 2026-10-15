# Run record: T6 (#8)
Date 2026-10-10, 10:54–11:14 UTC. Apple M5 Pro (15 cores, 48 GiB). Commits: pre-registration fb8dd96; harnesses 9058152 (+ zk-creds patch record).
Toolchains: Go 1.27.2 (Homebrew, installed for this task); rustc 1.98.1; Python 3.11.15 (uv venv `vendor/dacenv`, Homebrew OpenSSL 3.6.4);
node 24.14.1 / snarkjs 0.7.6; anvil 1.5.1 (prague, port 8570; public test keys).
Official code in `vendor/` (git-ignored): go-ucan 46ec5c698dec427af6823ee9337b203163538299; DAC-from-EQS 4ff86a3333ef0eedc74d0e94d177146a1ac16647
(petlib 7aafddb4, bplib caro3801@129533b7, coconut-lib d45b1426); zkcreds-rs 197e46f70e95fe16e73ddb917b187a106742d037 (+ `zkcreds_patch/`).
Command: `./run_t6.sh` (steps and exit codes in `results/logs/steps.txt`, all 0). Analysis: `node analyze_t6.mjs > results/analysis.json`.
Seeds: comp_bench `t6-comp-<block>-<D>`, instance seed 10000·block + 100·D + k; go-ucan / DAC use fresh random keys per sample (not seeded; values
are timings and sizes, not outcomes that depend on the keys).
Smoke runs (not evidence, not kept) fixed: go-ucan algorithm registration; DAC single attribute set failure; zk-creds passport panic (bench target).
