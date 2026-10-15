# Audit follow-ups — run record (2026-10-16, Mac M5 Pro)
- **F2.** The loop in `F2_paired/bench_log.txt`: `prove_bench.mjs 10` in `zkdac_v9_1` / `zkdac_v9_2`, order A B B A B A A B, 11:46:53–11:59:32 UTC. Summary: inline Python → `F2_paired/summary.txt`.
- **F1.** `python e6e_m2_ci.py m2 > m2_ci.json`, then the same for `m3` (E6b venv), 11:59:49–12:02:47 UTC. Data: E6e's committed `world_M.jsonl` and `knowledge.json`.
- **F3.**
  - `forge build`; `forge test --match-contract T7cWindowBoundaryTest`; `forge test` (full).
  - Mutations in scratch copies of `work/t4_contracts/foundry` (`sed` on one line each): `forge test --match-contract "V92Test|T7cWindowBoundaryTest"`.
  - Logs in `F3_windows/`.
