# E6d — multiple independent privacy worlds + weak-leak positive controls (WP10, research design Q4 / E6) — pre-registration

Committed and pushed BEFORE any world is built or any transcript is generated.
- Base: branch `e6d-worlds` = `v9-2-f2` (f1b0d2c; v9.2 = tag `v9.2-freeze-20261013`).
- Plan: `work/plans/NEXT_ROUND_PLAN_20261013.md` WP10. Party A's handoff asks for "multiple independent privacy worlds and weak-leak positive controls".
- **Empirical only, not a proof of anonymity.** A negative result covers these attacks and features, at the measured power. Privacy rests on the assumptions of `../../t7_proofs/T7c-proof-mapping_20261013/GAMES_v9_1.md` §8.

## What E6b/E6b2 left open
| E6b / E6b2 limitation | this experiment |
|---|---|
| one world (T5), D = 4 only | 8 independent worlds, D ∈ {2, 3, 4}, different fan-outs and master structures |
| identical action fields (amount 1, one method, one target) | action fields drawn i.i.d., independently of identity |
| only strong controls (equal words, AUC ≈ 1) | weak-leak controls at 5 strengths in 3 channels: the minimum detectable effect is measured |
| 100 / 1,000 refits per permutation test (4 h) | one unit-level train/test split per world, with the held-out labels permuted at the unit level (no refit, B = 10,000) |

## Worlds (seeds `e6d-w1` … `e6d-w8`; built offline in JS with the generators of the v9 line; no chain)
Each world has its own humans, keys, issued tree, registered-root tree, revocation IMT (genesis with 20 decoys), and note tree. Every world has K = 64 agents at depth D_w. One human registers each master.

| world | D | parents × children per parent | structure above the parents |
|---|---|---|---|
| w1 | 2 | 8 × 8 | the parents are 8 masters |
| w2 | 2 | 16 × 4 | the parents are 16 masters |
| w3 | 3 | 8 × 8 | 2 masters × 4 parents |
| w4 | 3 | 16 × 4 | 4 masters × 4 parents |
| w5 | 3 | 8 × 8 | 8 masters × 1 parent |
| w6 | 4 | 8 × 8 | 2 masters × 2 × 2 parents |
| w7 | 4 | 16 × 4 | 2 masters × 4 × 2 parents |
| w8 | 4 | 8 × 8 | 4 masters × 1 × 2 parents |

Corpus per world:
- Each agent receives one budget note (q = 10,000; owner = agent; lineage = its certificates). The notes are inserted in a seeded random order.
- m = 16 actions per agent, run in rounds. In each round every agent acts once, in a seeded shuffled order. Each action spends the agent's current note and inserts the change note, as the gate does.
- That gives 1,024 transcripts per world and 8,192 in total.
- Real Groth16 proofs from the v9.2 circuit (local build; zkeys = release `v9.2-proving-material-20261013`). Every proof is verified with the committed v9.2 VK.
- Fresh CSPRNG randomness (as a wallet) for: the encryption, the ctx nonce, the change rho and params.

**Action fields are i.i.d. per action and independent of identity:**
- amount ~ U{1..9} (= q_spent);
- method ∈ {0xa9059cbb, 0x095ea7b3}; both have the same required cap, the instances' act_req_cap;
- target ∈ {two fixed addresses};
- params = 4 random bytes;
- now = 10^6 + 600 · round + U{0..59}.

The issued, revoked and root roots are one snapshot per world. note_root changes with every action, but the shuffled order makes it independent of identity.

**Leakage function L.** These are published, but carry no identity information here by construction: D (constant within a world), the action fields, now, the roots, req_cap, TPK.

**Transcript** = everything an observer or a colluding verifier sees, exactly as E6b: proof (8 words) + the public signals + the three roots in calldata.

## Tests (per world; fresh corpus)
- **D1, D2.** Deterministic tests exactly as E6b `analyze.py`: shared word values across transcripts; equal ciphertext differences; budget_nf equal to any cm_change. Expected 0 in every world.
- **Classifier tasks.**
  - C1: same-agent pairs vs different-agent pairs.
  - C2: sibling pairs (different agents, same parent) vs pairs with different parents.
  - Features: E6b's `pair_features`, reused unchanged on the world's non-constant positions.
  - Models: logistic regression (L2), random forest (300 trees), k-NN (k = 15), as E6b. scikit-learn 1.5.2, random_state 0.
- **Split.** One split per world and task, by unit (C1: agents; C2: parents), 50 % train / 50 % test, seed `e6d-split-<w>-<task>`. Pairs are sampled inside each side: 1,792 positive and 1,792 negative per side, seed `e6d-pairs-<w>-<task>-<side>`.
- **Statistic.** Test-set ROC-AUC.
- **Null.**
  - The test units' labels are permuted at the unit level, with counts kept: C1 permutes the agent identity of the test transcripts; C2 permutes the parent assignment of the test agents.
  - The scores stay fixed. This is exact, because the model never saw the test labels.
  - B = 10,000; p = (1 + #{null ≥ observed}) / (1 + B).
- **Per world.** AUC, 95 % cluster-bootstrap CI over test agents (2,000), and p.
- **Combined across worlds (primary).** Fisher's method over the 8 world p-values per (task, model): χ² with 16 degrees of freedom. The primary family is {C1, C2} × 3 models = 6 tests, Holm-corrected.
  - **Decision: LINK iff the Holm-adjusted combined p < 0.01.** No AUC threshold. The 0.55 threshold of E6b would define the detectable effect by fiat; AUCs are reported instead.
- **Effect size.** The mean test AUC over the 8 worlds, with a t-based 95 % CI (7 degrees of freedom).

## Weak-leak positive controls (the main new result)
- **Injection.** Leaks are injected at analysis time into copies of each world's fresh transcripts. No new proofs; a modified transcript is not a valid proof, and that is irrelevant to a linkability test.
- **One channel at a time.** For each task, every identity unit u (agent for C1, parent for C2) gets a secret bit b_u ~ Bernoulli(1/2), seed `e6d-leak-<w>-<task>`. Per transcript, the effective bit is b_u, flipped with probability ε.
- **Channels:**
  - W1 *payload bit*: one extra word whose bit 0 is the effective bit and whose other 63 low bits are uniform.
  - W2 *timing*: now ← now + 30 · effective bit (the round jitter is U{0..59}, so the offset is partly masked).
  - W3 *length*: one extra word equal to the effective bit, standing for calldata length or presence of an optional field.
- **Strength.** ε ∈ {0, 0.30, 0.40, 0.45, 0.48}. The per-transcript agreement with the unit bit is 1 − ε. Within a unit, two transcripts agree with probability (1−ε)² + ε²; across units, 1/2.
- **Detection.** Same pipeline and same rule. For each (channel, ε), the family is {C1, C2} × 3 models. A cell is detected iff its Holm-adjusted combined p < 0.01. The per-world raw detection rate (p < 0.01) is reported with a Clopper–Pearson CI.
- **Minimum detectable effect (MDE), defined here.** For each channel and task, the largest ε (that is, the weakest leak) at which at least one model is detected in the combined decision **and** that model's per-world detection rate is ≥ 7 / 8.
- **Pre-declared expectations.**
  - ε = 0 and ε = 0.30 are detected in every channel and task.
  - ε = 0.48 (agreement 0.52) is not expected to be detected.
  - 0.40 and 0.45 are open.
- **Void rule.** If ε = 0 is not detected for some (channel, task), the negative result for that task is void.
- **Reporting.** The real-data result is reported as "no link detected stronger than the MDE", with the MDE given per channel. It is not reported as "no link".

## Not covered (stated in advance)
- Master linkage and corrupted ancestors: WP11 (E6e).
- Network, gas payer and real timing side channels.
- Partial randomness reuse: D1 detects any reuse of encryption randomness exactly, as in the E6b P1 control; no classifier power question.
- Key or certificate revocation entries (E3 L2/L3, disclosed).

## Outputs
- `results/world_w*.jsonl` (transcripts), `results/gen_w*.stderr`, `results/verify.json`;
- `results/deterministic.json`, `results/classifiers.json`;
- `RESULTS.md`, `RUN_RECORD.md`, `MANIFEST.sha256`.

Failures are kept. Any change after this commit is recorded as an amendment, with the time and the reason, before the affected run.

## Amendment A1 (2026-10-13T14:54Z; committed BEFORE any analysis of the real transcripts)
**Context.** The real transcripts were being generated when this was written; the analysis had never read them, and only line counts had been checked.
The changes were found by running the analysis code on **synthetic** worlds: the smoke transcripts with randomised words, kept in the scratchpad and not used as evidence.

1. **Null distribution.** The pairs are sampled by label (balanced classes). Permuting the labels of a fixed, already scored pair set is therefore not an exact test.
   - Instead, the observed statistic and every null draw run the *same* procedure: sample pairs under the (true, resp. unit-permuted) labels, then score them.
   - To make this affordable, every eligible pair of test transcripts is scored once by the fixed model (all pairs; C1: different rounds, C2: different agents), and each draw looks the scores up. This is identical to re-scoring, because a fixed model gives a pair the same score.
   - **B = 1,000** instead of 10,000, for cost (≈ 1 min per test). The per-world minimum p is 1/1001; the Fisher combination over 8 worlds still reaches far below 0.01.
2. **D1 / D2 positions.** These now cover only the words that must never repeat: proof, ciphertext, budget_nf, cm_change.
   - The L-words (now, ctx_hash, req_cap, tpk, state_root, note_root, q_spent, roots) now carry i.i.d. public action data and may repeat by design. In E6b they were constant, and therefore excluded automatically.
3. **C1 pairs only from different rounds, in both classes.**
   - Every agent acts once per round, so same-agent pairs are never in one round, while different-agent pairs would be in 1 / 16 of cases.
   - Sampling negatives from the same round would let a classifier learn "same round ⇒ different agent", which is a scheduling artefact, not a leak.
4. **Arithmetic features added** for small numeric words (all values < 2^53: now, q_spent, injected 0 / 1 words):
   - |a − b|;
   - a and b mod 60 and mod 600;
   - |a mod 60 − b mod 60| and |a mod 600 − b mod 600|.

   Reason: on the synthetic worlds, the E6b feature set (only bitwise and modular features) gave AUC 0.50 for the W2 timing control at ε = 0. A timing offset is invisible to those features by construction, and the void rule would then have voided the negative result because of a feature gap. With the added features the same synthetic control gives AUC ≈ 0.55. The E6b features are unchanged and form the prefix of the feature vector; equality with E6b's `pair_features` was checked on 2,400 pairs (`analyze_e6d.py check`).
5. **Unchanged:** the worlds, the corpus, the tasks, the models, the split, the channels, the strengths, the Fisher / Holm decision rule, the MDE definition and the void rule.
   - The W2 control is weak by design: a 30 s offset under 60 s jitter gives a theoretical pair AUC of ≈ 0.57 at ε = 0. Whether W2 reaches the 7 / 8 per-world criterion is open.
