# T8d — WP13: key results rerun in the second environment — pre-registration

Committed and pushed BEFORE any of these runs.
- Base: main dbf771c.
- Plan: `work/plans/NEXT_ROUND_PLAN_20261013.md` WP13 (PR #61). Rerun in the second environment (RTX6000):
  - (1) T3 v9.1, in full;
  - (2) the WP5 forge tests, in full;
  - (3) a scaled-down T5 (128 agents, 30 witnesses).
- **Compare the judgments.** Latency is reported only; it is not a pass condition, because the hardware differs.

## Items
- **R1. T3 differential suite, v9.1 and v9.2** (the plan names v9.1; v9.2 is the current version, so both are run).
  - `t3_attacks/v9_1/attacks_v9_1.mjs` and `exhaustive_diff_v9_1.mjs 4`;
  - `t3_attacks/v9_2/attacks_v9_2.mjs` and `exhaustive_diff_v9_2.mjs 4`.
  - Unchanged scripts, run in the second environment.
  - **Pass:** every row's (id, name, D, class) and every failure location (template, line) equal the committed first-environment results in `t3_attacks/v9_1/results/` and `t3_attacks/v9_2/results/`. The exhaustive-diff summary counts are equal too.
  - Differences are reported row by row as findings.
- **R2. forge, full suite:** already done for v9.2 in T8c item C4 (367 / 367, merged in #68). It is cited, not rerun.
- **R3. Scaled-down T5 on v9.2** (`t5s/` = T5's scripts; the diff against T5 shows only three changes):
  - zkdac_v9 → zkdac_v9_2 paths;
  - verifier names V9CD → V92CD;
  - world size from `T5_NM` / `T5_FAN` = **8 masters, fan-out 4**: 182 agents, 8 / 14 / 32 / 128 at D = 1 / 2 / 3 / 4.

  Steps, the same on both machines, with the same deterministic keys and seeds:
  - world build: registrations, mints, transfers, issued root;
  - E4a steady: 3 blocks × 10 actions per D, **30 witnesses per D**;
  - E4b epoch 1: all 182 agents act on one snapshot;
  - E4b revocation at 1 % and 10 % of the edges.

  The first environment (Mac) runs first, and that run also serves as the smoke run. **Pass:** equal judgments in both environments:
  - number of setup transactions and their status;
  - every action's status and revert reason (E4a, epoch 1);
  - accepted / rejected counts and blocked / free agent sets (revocation);
  - witness-level counts.

  Gas is expected to be equal per transaction kind up to note-index effects. The note insertion order is deterministic, so gas is compared too. Latency is reported per machine only.

## Outputs
- `results/mac/` and `results/env2/` (R1 env2 only; R3 both);
- `results/compare.json`;
- `RESULTS.md`, `RUN_RECORD.md`, `MANIFEST.sha256`.

Failures are kept. Changes after this commit are amendments, recorded before the affected run.

## Amendment A1 (2026-10-15T04:35Z, after the first Mac start, before any result)
- The first Mac start of R3 failed immediately with "Cannot find module 'ethers'" (`results/mac/attempt1_t5s_path/`).
- Cause: `t5s/` lies one directory deeper than T5, so `common.mjs` resolved `work/` one level too high.
- Fix, a **fourth** change to the T5 copy: `WORK = path.resolve(HERE, "../../..")`. Nothing else changed. The run was restarted.
