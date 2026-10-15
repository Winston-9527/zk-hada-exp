# Audit follow-ups (user decision 2026-10-16): three targeted checks — pre-registration

Committed and pushed BEFORE any of the three is run.
- Base: main eae5864, which includes the audit corrections of #82.
- Context: `../AUDIT_R76-81_20261015.md`.

## F1 — E6e M2 / M3 cluster-bootstrap CIs (pre-registered at E6e PREREGISTRATION :143, missing; audit #78 F7)
- **Procedure.** A new script `e6e_m2_ci.mjs` / `.py` reproduces `analyze_e6e.py`'s `m2_test` exactly: same rows, features, models and seeds. It adds a 95 % cluster-bootstrap CI over the test units, 2,000 resamples, seed 0.
  - **Units:** masters for M2a-M and M2b-M, parents for M2a-P and M2b-P.
  - **Weights:** a row (transcript t, hypothesis h) gets weight c[unit(t)] · c[unit(h)] for M2a and c[group] for M2b, where c counts how often each unit was drawn.
  - **Scores are fixed** (no refit), as in M1; this is stated.
- **Validity check.** For every variant, task and model, the AUC and p must equal the committed `m2.json` / `m3.json` exactly. Otherwise the CI output is void, and the mismatch is reported.
- **Data:** the committed `world_M.jsonl` and `knowledge.json`. No new transcripts.
- **Output:** `F1_e6e_ci/m2_ci.json`, `m3_ci.json`.

## F2 — T8c item A with counterbalanced order (audit #80 F8)
- **Design.** `prove_bench.mjs 10` of v9.1 and v9.2 in the order **A B B A B A A B** (A = v9.1, B = v9.2): 4 runs each, D = 1..4, seeds 1000–1009.
- **Conditions.** No other project process runs on the Mac. The load average is logged before and after each run.
- **Report:**
  - per D, the mean of the 4 v9.2 runs minus the mean of the 4 v9.1 runs;
  - a paired comparison by adjacent pairs (AB, BA, BA, AB), which gives 4 differences with sign alternation of order;
  - the run-to-run SD within each version.
- **Expectation:** |v9.2 − v9.1| within the run-to-run variation, and no consistent sign once the order is balanced.
- **Output:** `F2_paired/`.

## F3 — window boundaries and mutation sensitivity (audit #81 F7)
- **(a)** `V92.t.sol:test_GB7` already executes a real v9.2 proof on the revoked-root boundary: accepted at t0 + Δ, rejected at t0 + Δ + 1, with the revocation at t0 = NOW. **Mutation test:** in a scratch copy, change `ZkDacRevocations.rootAccepted`'s `<=` to `<`. **`test_GB7` must fail.**
- **(b)** The gate's `_rootOk` (note-root and issued-root windows) has no accept-at-boundary test. Two new tests go in `T7cWindowBoundary.t.sol`, which reuses the V92 fixtures:
  - **note root:** a proof on a retired note root is accepted at retirement + NWIN and rejected at + NWIN + 1;
  - **issued root:** after `updateIssuedRoot`, a proof on the old issued root is accepted at + IWIN and rejected at + IWIN + 1.

  **Mutation test:** in a scratch copy, change `_rootOk`'s `<=` to `<`. **The new tests must fail.**
- **Pass:**
  - every unmutated test passes, including the full forge suite;
  - every mutation is caught.
- **Output:** `F3_windows/` (logs).

Failures are kept. Changes after this commit are amendments, recorded before the affected run.
