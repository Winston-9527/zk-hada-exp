# T5c — interactions, part I2: fan-out × concurrency (WP8) — pre-registration

Committed and pushed BEFORE the harness is written. Parts I1 and I3 are in `PREREGISTRATION.md` / `PREREGISTRATION_I3.md` (merged in #67).
- **Plan WP8 I2:** fan-out {1, 8, 32} × concurrency {1, 8, 32, 128}, 12 cells. Single-chain cost and whole-tree cost are reported separately.
- **Question.**
  - How does the cost of building a delegation tree split between fixed, per-edge and per-action parts as the fan-out grows?
  - When k agents of one subtree act on one snapshot at the same time, what limits them?
  - Does the fan-out change either?

## World (one per run; v9.2, real proofs and real verifiers)
- Chain: H → master M (registered with a real registration proof) → parent P → **f children** C1..Cf.
  - The children act at **D = 3**, which is the measured depth.
  - Keys are `sha256("i2-node-<seed>-" + name)`.
- **Contracts:** ZkDacRegistry, ZkDacRevocations and ZkDacGateV9 with the v9.2 verifiers, budget transfer and mint verifiers, all real, on anvil.
  - Block gas limit **30M**, one block every **12 s**, as in T5 E4b. Automine is off.
  - Note window 600 s, revocation window 30 s (no revocations here).
- **Budget, all real transactions with real proofs:**
  - The operator mints one note to M.
  - M delegates to P (`transferBudget`, delegate).
  - P delegates to each child (f transfers).
  - Each child splits its note into the n_c notes of 10 it needs (n_c − 1 splits; n_c = ceil(k / f) × R).
  - `updateIssuedRoot` once, after issuing the f + 1 certificates.
  - `registerState` once.

## Factors and runs
- **f ∈ {1, 8, 32} × k ∈ {1, 8, 32, 128}** = 12 cells × **3 seeds** = 36 runs.
- **Action rounds per run: R = ceil(10 / k).** That gives k = 1: 10 rounds, k = 8: 2 rounds, k ≥ 32: 1 round. So every cell has ≥ 30 actions over its 3 seeds.

## Protocol of a round
1. At the round start t0, k actions (amount 10) are assigned round-robin to the children. Each uses one of its own pre-split notes, so no two actions share a note.
2. All k proofs are built against the same snapshot (the state at t0) and submitted at once.
3. Blocks are mined every 12 s until all are included. Anvil fills each block up to the gas limit, in submission order (seeded shuffle).
4. The next round starts after the last inclusion.

## Metrics
**Tree cost (per run):**
- the gas of every setup transaction, by type (register, mint, delegate-transfer, split-transfer, updateIssuedRoot, registerState);
- **whole-tree cost** = the sum;
- **per-chain cost** = (fixed costs: register, mint, M→P transfer, updateIssuedRoot, registerState) / f + per-child costs (P→Ci transfer and the child's splits) / f;
- off-chain issuance per edge (key generation and certificate signature): from T5, not re-measured.

**Action phase (per round):**
- rejections by reason (expected: none);
- blocks to include all k;
- per-action inclusion latency in blocks;
- per-action execute gas and its change-note index.

**Witness checks:** every action and transfer carries a real proof that the on-chain verifier accepted. Nothing is mocked.

## Statistics
- **Run-level responses:**
  - (i) mean execute gas per action;
  - (ii) mean inclusion latency in blocks;
  - (iii) per-chain cost (tree part).
- **Interaction f × k:** Freedman–Lane permutation test as in I1, 10,000 permutations, with the interaction SS share. Holm over the three.
- **Pre-declared expectations:**
  - No rejection.
  - The blocks to include k actions are ceil(k · g / 30M), where g ≈ 0.62–0.67M is the D = 3 execute gas. That gives about 1 block for k ≤ 32 and 3 blocks for k = 128.
  - Execute gas depends on the change-note index (T5: +27k per 1-bit), hence on f and k only through the tree size.
  - The per-chain tree cost falls with f, because the fixed costs are amortized; the whole-tree cost grows linearly in f.
  - Interactions (i) and (iii) come only through the note-tree size. Interaction (ii) is expected to be absent: latency depends on k only.

## Smoke first
A minimal run (f = 8, k = 8, one seed) on the Mac precedes the full run. It is not evidence.

## Machine
- The full run goes to the Mac M5 Pro if RTX6000 is still busy with E2b, otherwise to RTX6000.
- Gas, counts and block latencies do not depend on the machine. The wall time is recorded but not reported.

Failures are kept. Changes after this commit are amendments, recorded before the affected run.
