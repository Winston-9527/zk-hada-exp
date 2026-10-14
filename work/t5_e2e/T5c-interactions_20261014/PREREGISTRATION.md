# T5c — interactions, part I1: revocation rate × revocation window Δ (WP8, research design §6) — pre-registration

Committed and pushed BEFORE the harness is run on anything but a smoke cell.
- Base: main fd485dc (v9.2).
- Plan: `work/plans/NEXT_ROUND_PLAN_20261013.md` WP8 (PR #61).
- **This file covers I1 only.**
  - I2 (fan-out × concurrency) and I3 (D × accountability on/off) are pre-registered separately later.
  - I3 needs a v9.2 variant without accountability, with its own circuits and setup.
- **Question.** T5 measured one revocation burst at Δ = 30 s. Here the question is how the revocation rate and the window Δ **interact**:
  - Safety: a revoked branch must never act after t_rev + Δ.
  - Exposure: how long a revoked branch can still act.
  - Availability: how much unaffected agents pay in rejections and re-proving, and whether any of them is denied service.

## Machine and platform independence
- Runs on the second environment (ssh `RTX6000`), as the user decided on 2026-10-14.
- Logical clock, as in E2b: block timestamps are set explicitly.
  - One block every **2 s**. One epoch = **15 blocks = 30 s**.
  - The proving time per depth is fixed to the Mac v9.1 medians: **t_p = 0.787 / 1.377 / 2.240 / 2.585 s for D = 1..4** (`../../t2_circuit_fix/zkdac_v9_1/RESULTS.md`, row 6, run 2).
- No reported number depends on the server's speed.

## World (one per run)
- **The T5 tree:** 32 registered masters. M0 and M1 fan out 8 × 8 × 8 down to D = 4; M2..M31 have one child each.
  - That gives **1,230 agents** (D = 1 / 2 / 3 / 4: 32 / 46 / 128 / 1,024) and 1,198 delegation edges (certificates at hop ≥ 1).
  - Keys are `sha256("t5c-node-" + name)`. Humans use the registration helper's keys.
- **Contracts.** ZkDacGateV9, ZkDacRevocations and ZkDacRegistry on anvil.
  - **The proof verifiers are replaced by an accept-all contract** (`T7cAcceptAll`), as in the T7c R1 mock run. Every other check of the gate and of the revocation contract is the real code: roots, revocation window, note window, budget nullifier, clock.
  - The correctness of what is submitted is checked off-chain at three levels (see "Witness and proof checks").
- **Windows.** Revocation window = **Δ** (the factor). Note window = 600 s. Issued-root window = 300 s (no issuance during the run). Clock skew = 3,600 s. Block gas limit = 60M, so capacity does not enter.
- **Notes.** The operator mints one note of q = 1,000 per agent. Each action spends 1 and inserts the change note.

## Factors and runs
- Revocation rate **r ∈ {0 %, 1 %, 10 %}** of the 1,198 edges: 0, 12 and 120 edges.
- **Δ ∈ {0, 1, 5, 20} epochs** = 0, 30, 150 and 600 s.
- 12 cells × **3 seeds** (`t5c-<r>-<Δ>-<seed>`) = 36 independent runs.
- A run lasts **30 epochs** (900 s).

## Protocol
- **Revocations.**
  - The r % edges are sampled uniformly (seeded).
  - Each is revoked at a uniformly random time in epochs [5, 10), one revoke transaction each.
  - The operator registers the new state root (`registerState`) in the same block.
- **Honest agents** act once per epoch, at a seeded uniform offset inside the epoch.
  - At action time τ, the agent observes the state of the latest block ≤ τ and builds its transaction against that state's revoked root and note root, if its witness exists there.
  - The transaction arrives at τ + t_p(D) and is included in the next block.
  - On a revert, the agent re-observes at the inclusion time and tries again, with **at most 4 attempts per action**. After that, the action is "denied" for this epoch.
- **Revoked descendants** (all descendants of a revoked edge, from the block of that revocation on) act **adversarially**:
  - Every epoch, they try to act with the **last revoked root under which their lineage was not revoked**. The circuit is satisfiable there, and they hold that snapshot.
  - They also try a fresh witness on the current root. This must not exist: no non-membership witness.
  - Only the old-root transaction is submitted. There are no retries.

## Metrics (per run)
- **H1, safety (hard).** For every revoked edge e with on-chain revocation time t_e: the number of actions of its descendants accepted in a block with timestamp > t_e + Δ. **Must be 0.**
- **H2, strict collateral denial (hard).** A strictly denied agent is a non-descendant agent that, from some epoch on, is never accepted again until the end of the run. **Must be 0.**
- **Exposure**, per revoked edge:
  - the descendants' accepted actions after t_e;
  - the last acceptance minus t_e, which must be ≤ Δ.
- **Availability of non-descendants:**
  - accepted / demanded actions;
  - transient denials (the cap of 4 reached);
  - rejections by reason (StaleRevokedRoot, StaleNoteRoot, other);
  - attempts per accepted action (re-proving).
- **Witness and proof checks:**
  - (a) every adversarial fresh-root attempt: is a witness constructible? Expected: never.
  - (b) every adversarial old-root attempt that is submitted: real v9.2 witness calculation. Expected: satisfiable.
  - (c) 30 seeded honest submitted attempts per run: real witness calculation. Expected: satisfiable.
  - (d) 10 seeded **accepted** honest actions per run: a full real Groth16 proof with exactly the submitted public signals, verified with the committed v9.2 VK. Expected: valid.
  - (e) every revocation: a real revoke_transition witness for the submitted new root. Expected: satisfiable.

  Any violation is reported as a harness or protocol failure.

## Statistics
- **Run-level responses:**
  - (i) the transient denial rate of non-descendants;
  - (ii) attempts per accepted action of non-descendants;
  - (iii) the mean exposure per revoked edge (r > 0 only).
- **Interaction rate × Δ:** two-factor permutation test of the interaction (Freedman–Lane, residuals of the additive model), 10,000 permutations. The effect size is reported as the interaction sum of squares as a share of the total.
  - For (i) and (ii), over all 12 cells. For (iii), over r ∈ {1, 10} × Δ.
  - Holm over the three responses.
- **Pre-declared expectations:**
  - H1 = 0 and H2 = 0 in every run.
  - At r = 0: no StaleRevokedRoot rejection and no transient denial.
  - Exposure ≤ Δ, with a mean close to Δ for descendants that keep trying.
  - The re-proving cost grows with r and falls with Δ, with an interaction: at Δ = 0 and r = 10 %, 120 revocations within 150 s churn the root about every 1.25 s, which is shorter than every t_p plus one block. Many honest attempts are therefore rejected and some actions are transiently denied.

## Not covered
- I2 and I3; gas (the verifiers are mocked; T5 and E2b report gas with real verifiers).
- Key revocation (WP9); network latency; adaptive revocation strategies.

## Outputs
- `results/runs/r<r>-d<Δ>/<seed>.json`;
- `results/summary.json` and `results/stats.json`;
- `RESULTS.md`, `RUN_RECORD.md`, `MANIFEST.sha256`.

Failures are kept. Any change after this commit is recorded as an amendment, with the time and the reason, before the affected run.
