# E2b — multi-sender contention for one agent's budget (WP7): results

- **Pre-registration:** `PREREGISTRATION.md` (25a5be1, before the harness ran). Amendment A1 (a82968e): wording of t_p.
- **Run:** RTX6000, 480 runs = 16 cells × 30 paired seeds; every attempt carries a real v9.2 proof on the real ZkDacGateV9.
- **Logical clock:** t_p = 1.377 s. Every second below is logical-clock seconds, not a measurement of either machine.
- **Statistics:** `analyze_e2b.py` → `results/summary.json`. Commands: `RUN_RECORD.md`.

## Hard checks: hold in all 480 runs
- Accepted units ≤ budget in every run.
- Every budget nullifier is spent at most once (BudgetUsed events).
- Accepted events = accepted transactions.
- Every block order equals the seeded shuffle.
- Every rejection is **BudgetSpent**. No other revert reason occurred.

## Per cell (mean over 30 seeds)
| cell | budget | accepted actions (min–max) | accepted units | stopped: retry cap / exhausted | attempts | max accepted per block | effective parallelism (actions/s) | latency p50 / p95 (s) |
|---|---|---|---|---|---|---|---|---|
| A, k = 1 | 100 | 1 | 10 | 0 / 0 | 1.0 | 1 | 0.55 (b = 1 s), 0.45 (b = 2 s) | 1.9 / 2.3 |
| A, k = 8 | 100 | 4.2–4.7 (4–5) | 42–47 | 3.3–3.8 / 0 | 25 | 1 | 0.49 | 4.2–5.1 / 8.2–9.0 |
| A, k = 32 | 100 | **5.0 (5–5)** | 50 | 27 / 0 | 121 | 1 | 0.50 | 4.8–5.4 / 8.3–9.0 |
| A, k = 128 | 1,280 | **5.0 (5–5)** | **50 of 1,280** | 123 / 0 | 505 | 1 | 0.50 | 5.0–5.5 / 8.3–9.1 |
| B, k = 1 | 100 | 1 | 10 | 0 / 0 | 1.0 | 1 | 0.55, 0.45 | as A |
| B, k = 8 | 100 | **8.0** | 80 | 0 / 0 | 11 | 5–6 | 1.29–1.30 | 2.0–2.7 / 5.7–6.0 |
| B, k = 32 | 100 | **10.0** | **100 of 100** | 0 / 22 | 39–43 | 9 | 2.40–2.90 | 1.7–1.9 / 2.3–3.8 |
| B, k = 128 | 1,280 | **124.4–125.7** (122–128) | 1,244–1,257 | 2.3–3.6 / 0 | 202 | 44–57 | **12.6** | 2.1–2.9 / 6.3–7.2 (p99 8.2–8.9) |

Ranges are b = 1 s – b = 2 s. p99 is reported only where ≥ 300 latencies exist.

**Reading.**
- **One note serializes the agent.** With one note (A), every sender spends the same note version, so exactly one action per block is accepted. Effective parallelism is pinned at ≈ 0.5 actions/s whatever k is.
  - Under the pre-registered client policy (at most 3 retries), most senders give up. Only 5 of up to 10 (k = 32) or 128 (k = 128) affordable actions succeed.
  - That is 50 of 1,280 budget units at k = 128. The rest is unspent, not lost.
  - The failed attempts waste gas: 32.4M per run at k = 128.
- **Pre-splitting restores parallelism** (B). Senders collide only when they pick the same note.
  - k = 8 and k = 32 succeed fully. At k = 32, the 10 notes cover the whole budget, and the 22 other senders stop correctly with "exhausted".
  - At k = 128 with 128 notes, 97–98 % of the actions succeed. Up to 57 are accepted in one block.
- **Safety never depends on the contention.** No run overspent, and no nullifier was reused.

## Primary comparison: effective parallelism B − A, paired by seed (k ≥ 8)
| k, b | mean B − A (actions/s) | paired bootstrap 95 % CI | p (sign flip) | Holm p |
|---|---|---|---|---|
| 8, 1 s | +0.80 | [0.71, 0.88] | 1e−4 | **6e−4** |
| 8, 2 s | +0.81 | [0.72, 0.90] | 1e−4 | **6e−4** |
| 32, 1 s | +2.40 | [2.21, 2.59] | 1e−4 | **6e−4** |
| 32, 2 s | +1.89 | [1.77, 2.00] | 1e−4 | **6e−4** |
| 128, 1 s | +12.15 | [12.01, 12.31] | 1e−4 | **6e−4** |
| 128, 2 s | +12.09 | [12.05, 12.13] | 1e−4 | **6e−4** |

All six comparisons are significant. The expectations of the pre-registration hold:
- at most one acceptance per block in A;
- A below budget / 10 actions for k ≥ 32;
- B above A.

## Other metrics
- **Gas per accepted action:** 551k (A) vs 643k (B, k = 128). The note tree is larger in B (≈ 253 leaves vs 6), which matches the index effect found in T5.
- **State growth per run:** note leaves 6 (A, k = 128) vs 252–254 (B, k = 128); budget-nullifier slots = accepted actions.

## Failures (kept)
Two runs (B, k = 128, b = 2 s, seeds 0 and 12) failed twice at start-up with "could not detect network". Anvil could not bind their deterministic ports, 9090 and 9102, which another service on RTX6000 occupies.
- No chain action happened in the failed attempts.
- Attempt 3 used free ports 9600 and 9601, otherwise unchanged; both exited 0.
- The failed attempts are in `results/runs/B-k128-b2/attempt{1,2}_*`.

## Deviations
- Logical clock instead of interval mining (pre-registered deviation from the plan).
- The two runs above used other ports in attempt 3.
