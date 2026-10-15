# E8 — run record
- **Mac smoke runs (not evidence):** seed 0 of A2, A1 and A3; A3 was re-run twice after fixes (amendment A1).
- **RTX6000 smoke runs (not evidence):** seed 1 of A1, A2 and A3, all passed.
  - Setup: worktree `~/projects/zk-hada-exp-e8` at bee141e; node_modules and circuit builds symlinked from the main clone; `forge build` in the worktree (app contracts).
  - Ports 8840–9018 (anvil) and 9900–9958 (A1 gateway) were checked free (9998 and 9999 are occupied on the server and are not used).
- **Full run:** `nohup bash run_e8.sh 12`, 2026-10-15 06:58:52–07:34:59 UTC, 90 / 90 exit 0 (`results/run_status.txt`).
- **Latency:** `SEED=0 node a{1,2,3}.mjs` on the Mac, one after the other, 06:56:35–06:59:37 UTC. No other project process was running (`results/latency_mac/log.txt`).
- **Summary:** `python summarize.py > results/summary.json` (E6b venv, scipy).
