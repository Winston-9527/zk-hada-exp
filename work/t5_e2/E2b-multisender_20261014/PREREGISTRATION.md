# E2b — multi-sender contention for one agent's budget (WP7, research design E2) — pre-registration

Committed and pushed BEFORE the harness is run on anything but a smoke cell.
- Base: main 8a7cd87 (v9.2).
- Plan: `work/plans/NEXT_ROUND_PLAN_20261013.md` WP7 (PR #61). It asks: does the budget stay safe when many uncoordinated senders compete for it, and how much parallelism does pre-splitting the budget buy?
- E2 (`../E2-budget_20261009/`) left open: one sender, a fixed order, no concurrency sweep.

## Machine and platform independence
- Runs on the second environment (ssh `RTX6000`, `~/projects/zk-hada-exp`), as the user decided on 2026-10-14.
- **No reported quantity depends on the machine's speed.**
  - Time is a **logical clock**: block timestamps are set explicitly.
  - Proving takes a fixed **t_p = 1.377 s**. This is the Mac M5 Pro median for v9.1 D = 2 (`../../t2_circuit_fix/zkdac_v9_1/RESULTS.md`, row 6, run 2); v9.2 adds one constraint.
  - The harness waits for each real proof, but the chain sees it as ready t_p after the sender observed the state.
- Wall-clock times of the run are recorded but not reported as results.

## World (one per run)
- **Contracts.** Fresh anvil (default test mnemonic, 130 local accounts) with ZkDacRegistry, ZkDacRevocations, and ZkDacGateV9 with the **v9.2** verifiers.
  - The revocation window and registry window are irrelevant here and set long.
  - **noteWindow = 600 s**, as in E2.
  - clockSkew = 3,600 s.
- **One agent A.** Chain H → M → A, D = 2. The root certificate is registered with a real registration proof.
- **k senders S1..Sk.** Each has its own EOA. All act for A: they hold A's key and share A's wallet, meaning the set of A's notes and their openings. They do **not** coordinate. A sender sees exactly the chain state at the moment it observes, plus the wallet's openings of the notes on chain. The change note of a successful action enters the shared wallet when the transaction is included.
- **Demand.** Every sender wants to execute one action of 10 units (method 0xa9059cbb on a mock target).
- **Budget, minted by the operator** with real mint proofs:
  - **Condition A:** one note of 100 units (1,280 for k = 128).
  - **Condition B:** the same budget as notes of 10 units: 10 notes (128 for k = 128).

## Protocol (logical time)
- **Blocks.** One block every b seconds, with b ∈ {1, 2}. A block contains every transaction that arrived in (t_prev, t_block], in a **random order**. The order is a seeded shuffle and represents mempool ordering among equal fees. Automine is off: blocks are mined with `evm_setNextBlockTimestamp` + `evm_mine`.
- **Start.** Sender i starts at s_i ~ U[0, 2) s (seeded).
- **Attempt.** At time τ, the sender:
  1. observes the state of the latest block with timestamp ≤ τ;
  2. picks a note:
     - A: the unspent note of the wallet with q ≥ 10;
     - B: an unspent note with q ≥ 10, chosen uniformly at random (seeded);
  3. builds a real v9.2 proof against that state's note root;
  4. the transaction arrives at τ + t_p.

  If no unspent note with q ≥ 10 exists, the sender stops with "exhausted".
- **Failure.** If the transaction reverts, the sender retries at the timestamp of the block that contained it: it re-observes, re-picks and re-proves. There are **at most 3 retries** (4 attempts). After that the sender stops with "retry cap".
- **Run end.** The run ends when every sender has succeeded or stopped.

## Cells and repetitions
- Condition {A, B} × k {1, 8, 32, 128} × b {1 s, 2 s} = **16 cells**.
- **30 seeds per cell.** Each seed is an independent world: fresh anvil, fresh notes with fresh CSPRNG rho, and its own start times, block orders and B choices.
- Seeds are `e2b-<cond>-<k>-<b>-<seed>`. Seed s of A and of B in the same (k, b) uses the **same start times and the same block-order stream** (paired design).

## Metrics (per run)
- **Hard checks:**
  - accepted units ≤ budget;
  - every budget nullifier is spent at most once (from the BudgetUsed events);
  - every accepted transaction carries a real proof that the on-chain verifier accepted.

  A violation is a safety failure.
- **Counts:**
  - accepted actions and units;
  - rejections by revert reason (expected: BudgetSpent; any other reason is reported separately);
  - attempts per sender;
  - stops ("exhausted" or "retry cap");
  - wasted gas (reverted transactions);
  - gas per accepted transaction.
- **Latency of each accepted action** = inclusion time − s_i, in seconds of the logical clock and in blocks. p50 and p95 are reported per cell, pooled over seeds; p99 only if the cell has ≥ 300 accepted actions.
- **Effective parallelism** = accepted actions / (last acceptance time − first start time), in actions per second of the logical clock.
- **State growth:** note leaves inserted; storage slots written by the gate (budgetSpent entries, retired note roots, registered states).

## Statistics
- **Primary comparison:** effective parallelism, B − A, paired by seed, for each (k, b) with k ≥ 8. That gives 6 comparisons.
  - Mean difference with a paired bootstrap 95 % CI (10,000 resamples).
  - p from a paired sign-flip permutation test (10,000 flips).
  - Holm over the 6 comparisons; significant iff the adjusted p < 0.05.
- **Expectations, stated in advance:**
  - The hard checks hold in every run.
  - In A, at most one action is accepted per block, because every sender spends the same note version.
  - For k ≥ 8, A's effective parallelism is at most 1/b. Under contention many A senders hit the retry cap, so A accepts fewer than budget / 10 actions for k ≥ 32.
  - B's effective parallelism is higher than A's for k ≥ 8.
  - In B, collisions (two senders choosing the same note) cause retries. The retry rate grows with k / (number of notes).

## Not covered
- Real network latency, fee markets and priority fees: all transactions pay the same fee and the order is uniform.
- Senders of different agents: their notes never collide, by construction.
- Proving-time variation: t_p is fixed.

## Outputs
- `results/runs/<cell>/<seed>.json`, one per run;
- `results/summary.json` and `results/stats.json`;
- `RESULTS.md`, `RUN_RECORD.md`, `MANIFEST.sha256`.

Failures are kept. Any change after this commit is recorded as an amendment, with the time and the reason, before the affected run.

## Deviations from the plan (WP7)
- v9.2 instead of v9.1, because v9.2 is the merged version.
- A logical clock with fixed t_p instead of wall-clock interval mining and per-sender processes. Reason: the second environment would otherwise change the results through its proving speed.
- The 10 notes of B are minted directly instead of split from one note by transfers. The resulting state is the same: notes of 10 owned by A.
