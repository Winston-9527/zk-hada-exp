# E2b — run record
- **Environment.** RTX6000 (host enine, Xeon w7-3445 × 40), main clone `~/projects/zk-hada-exp` on branch e2b-multisender. Setup: `setup_env2.sh` (`results/setup/steps.log`): v9.2 c2 constraints 105,434; release zkey sha256 and zkey verify ok; VK = committed; forge build ok.
- **Smoke runs (not evidence):** Mac A-k8-b1; server tuning runs with J = 8 / 16 (≈ 1.4 proofs/s saturated).
- **Full run.** `nohup bash run_all.sh 16`, 2026-10-14 08:16:47 – 18:45:15 UTC (`results/run_start_attempt1.txt`). 478 / 480 exit 0.
- **Reruns.**
  - Attempt 2: `bash run_all.sh 2` on 2026-10-15 at 04:04; same ports; failed again.
  - Attempt 3: manual, 04:05 – 04:14 UTC, ports 9600 / 9601; exit 0. The commands are in `results/run_status.txt` (the "attempt 3" lines).
- **Analysis.** `python3 analyze_e2b.py > results/summary.json` (numpy), on the Mac after copying `results/` from the server.
