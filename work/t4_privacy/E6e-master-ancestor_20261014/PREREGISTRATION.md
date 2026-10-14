# E6e — master linkage, corrupted ancestor, colluding verifier (WP11, research design Q4) — pre-registration

Committed and pushed BEFORE the world is built and before any analysis code reads a transcript.
- Base: main 8a7cd87, which contains v9.2 (#64) and E6d (#65).
- Plan: `work/plans/NEXT_ROUND_PLAN_20261013.md` WP11 (PR #61).
- Research design Q4: "between two lineages that are equal on the specified public leakage, a colluding verifier together with an allowed corrupted delegator cannot additionally distinguish them".
- **Empirical only, not a proof.** A negative result covers these adversaries, these features and the measured power. Privacy rests on the assumptions in `../../t7_proofs/T7c-proof-mapping_20261013/GAMES_v9_1.md` §8 (DDH on BabyJub for the ElGamal encapsulation; Poseidon as a PRF for the keystream).

## What E6b2 / E6d left open
| gap | here |
|---|---|
| E6b2 C3 (same master) had 2 masters and 8 parents. Only 70 labellings existed, so p < 0.05 was impossible | M1: one world with 32 masters × 4 parents × 4 agents |
| E6d tested an outside observer only | M2: an ancestor that knows its subtree's keys, certificates and revocation handles |
| no colluding verifier | M3: the M2 ancestor plus the verifier's view (action contexts, submission order) |
| E6d's A1 features missed a one-bit leak (C1 void); A2 fixed it post hoc | both feature sets are pre-registered here, in one Holm family |

## World M (seed `e6e-M`; built offline in JS with the v9 generators; no chain)
- **Depth.** D = 3. The chain is H → master → parent → agent: ent[0] = human, ent[1] = master, ent[2] = parent, ent[3] = agent.
- **Tree.** 32 masters, each registered by its own human. 4 parents per master, 4 agents per parent: 128 parents and **512 agents**.
- **Shared state.** One issued tree, one registered-root tree, one revocation IMT (20 decoys) and one note tree, exactly as E6d.
- **Notes.** Each agent receives one budget note (q = 10,000). Notes are minted in a seeded random order.
- **Rounds.** m = 8. In each round every agent acts once, in a seeded shuffled order, and spends its current note. That gives **4,096 transcripts**.
- **Action fields.** Drawn i.i.d. and independently of identity, as in E6d:
  - amount U{1..9}; method one of two; target one of two; params 4 random bytes;
  - now = 10^6 + 600 · round + U{0..59}.
- **Proofs.** Real v9.2 Groth16 proofs, with fresh CSPRNG randomness. Every proof is verified with the committed v9.2 VK.
- **Generation in two phases.** No proof depends on another proof; only the note tree is sequential.
  1. The witnesses are built sequentially (tree state). They are written to `build/` and are not committed: they contain the secret keys.
  2. The proving is sharded over 8 processes.
- **Knowledge file `results/knowledge.json`.** It holds what each participant knows, per agent:
  - the chain names;
  - every ent public key (Ax, Ay);
  - the certificates cert[0..2], where cert[i] = Poseidon(i, issuer pk, holder pk, cap, expiry);
  - the key-revocation hashes H(KEY_TAG, Ax, Ay);
  - the initial note (cm, rho, q).

  It holds no secret keys. The analysis reads adversary knowledge only from this file.
- **Transcript.** Exactly as in E6d: proof (8 words) + the 19 public signals of D = 3 + the three roots in calldata. Unlike E6d, the analysis also keeps the action context (method, target, amount, params, nonce) and the submission order. Only M3 uses them.

## Allowed leakage (design leakage; not findings)
- **Outside observer:** L as in E6d (D, action fields, now, roots, req_cap, TPK).
- **An ancestor** knows, by design:
  - the certificates it issued, and every certificate, public key and key/lineage revocation handle in its subtree (the strongest reading of the plan);
  - its own ancestors' public keys and certificates, which it needs in order to delegate;
  - the initial notes of its subtree (the strongest reading: it is the minter).
- **Not tested, inherent to revocation:** active revocation probing. An ancestor revokes a descendant and observes which action stream stops. This is in L for any revocable scheme.
- **Opening:** the committee learns the chain. This is accountability by design and is excluded.
- Network, gas payer and real timing are excluded, as in E6d.

## M1 — outside observer, master task (plus C1 / C2 replicated)
- **Tasks.**
  - C1: same agent vs different agents. Different rounds only (E6d A1 item 3).
  - C2: siblings (same parent, different agents) vs different parents.
  - **C3: same master, different parents vs different masters.**
- **Features.**
  - **F1** = E6d A1 features: the E6b `pair_features` prefix plus the arithmetic timing features.
  - **F2** = F1 + per-bit agreement of the low 64 bits of every non-constant position (E6d A2).

  Both are run. Neither is privileged.
- **Models.** logreg, rf (300 trees), knn (k = 15), as in E6d; scikit-learn 1.5.2, random_state 0.
- **Split.** By unit (C1: agents; C2: parents; C3: masters), 50 / 50, seed `e6e-split-<task>`.
- **Pools.** Each side is reduced to 512 transcripts by a rule that does not look at the permuted label:
  - C1: 64 random agents of the side, with all 8 transcripts each;
  - C2 and C3: every unit of the side, with 2 random transcripts per agent (seed `e6e-pool-<task>-<side>`).

  1,792 positive and 1,792 negative pairs are sampled per side, as in E6d. The model is trained once. Every eligible test pair is scored once.
- **Null.** The test unit labels are permuted (C1: agent labels; C2: agent → parent assignment; C3: parent → master assignment; counts kept). Pairs are re-sampled and the scores looked up, exactly the E6d A1 procedure. **B = 5,000**, p = (1 + #{null ≥ obs}) / (1 + B).
- **Family M1.** 3 tasks × 2 feature sets × 3 models = 18 cells, Holm. **LINK iff the Holm-adjusted p < 0.01.** With one world there is no Fisher step. The minimum p of 1/5001 passes the smallest Holm threshold, 0.01/18.
- **Power controls (M1).** Leaks are injected at the unit of each task. The channels W1 (payload bit), W2 (+30 s timing) and W3 (0/1 word) are exactly as in E6d.
  - ε ∈ {0, 0.20, 0.30, 0.40}.
  - Derived maximum pair AUC for W1 and W3: 0.5 + (1 − 2ε)² / 4 = 0.75, 0.59, 0.54, 0.51.
  - Per (channel, ε), the family is the same 18 cells with the same rule.
  - **MDE** per (channel, task) = the largest ε at which any of the 6 cells of that task is detected.
  - **Void rule:** if ε = 0 is not detected for some (channel, task) by any cell, the negative result of that task is void.
- **Expectations.**
  - ε = 0 is detected in all channels and tasks, with W1 by F2.
  - ε = 0.20 is detected for W1 and W3.
  - ε = 0.30 is open.
  - ε = 0.40 is not expected (AUC ≤ 0.51).

## M2 — corrupted ancestor
Every adversary is an ancestor with the knowledge listed above. Scores are computed for pairs (transcript t, hypothesis h), where h is a subtree (membership tasks) or a candidate descendant (which-descendant tasks).

**Candidate features φ(t, h).** For every chain position j whose plaintext is known under h:
- y_j is the ent[j] y-coordinate; e_j is the masked word, e_j = y_j + Poseidon(K, j);
- the low 64 bits of (e_j XOR y_j);
- the low 64 bits of ((e_j − y_j) mod p);
- the Hamming weights of both.

When every parity is known (which-descendant tasks):
- the low 4 bits of (e_sign XOR packed parities);
- the low 64 bits of ((e_sign − packed) mod p).

Mask relations: for every pair of known positions j < k, the low 64 bits of m_j XOR m_k, with m_j = (e_j − y_j) mod p.

Under h = truth, m_j = Poseidon(K, j). Under a wrong h, m_j is shifted by a known difference. A difference is visible only if the keystream is not pseudorandom.

**Tasks.**
| task | adversary | rows | label | known positions |
|---|---|---|---|---|
| M2a-M | master | (t, master a), test transcripts × test masters | t is in a's subtree (rate 1/16) | 0, 1 |
| M2a-P | parent | (t, parent b), test transcripts × test parents | t is in b's subtree (rate 1/64) | 0, 1, 2 |
| M2b-P | parent | (t, agent c): t from b's subtree, c one of b's 4 agents | c produced t | 0..3, sign |
| M2b-M | master | (t, agent c): t from a's subtree, c one of a's 16 agents | c produced t | 0..3, sign |

- **Split.** By master (M2a-M, M2b-M) or by parent (M2a-P, M2b-P), 50 / 50, seed `e6e-split-<task>`. Training and test rows come from their own sides only. Training rows are subsampled to at most 20,000 per class (seed `e6e-train-<task>`).
- **Metric.** AUC over all test rows. For the which-descendant tasks, top-1 accuracy is also reported (chance 1/4, resp. 1/16).
- **Null.**
  - Membership: permute the master (resp. parent) labels of the test transcripts at the unit level, keeping the subtrees whole.
  - Which-descendant: inside every test subtree, permute the agent labels of its transcripts at the agent level.

  Scores stay fixed and are all computed once, so the null is exact. B = 5,000.
- **Family M2.** 4 tasks × 3 models = 12 cells, Holm, LINK iff the adjusted p < 0.01.
- **Deterministic dictionary test D3.** For every adversary (32 masters, 128 parents), take every value it can compute:
  - known public key coordinates, certificates, the truncated certificates (low 252 bits), key hashes;
  - initial note cm and rho;
  - and the negation mod p of each of these.

  Counted against all 4,096 transcripts:
  - (i) transcript words equal to any of these values;
  - (ii) residuals m_j = e_j − y_j equal to 0 or to any of these values, at every known position;
  - (iii) m_j = m_k for j ≠ k inside one transcript;
  - (iv) budget_nf or cm_change equal to any of these values.

  **Expected 0 everywhere.**
- **Power controls (M2).** Injected into copies of the transcripts at the adversary's distinguishing position: position 1 for M2a-M, 2 for M2a-P, 3 for M2b-*.
  - **K1 (mask bit):** with probability λ per transcript, bit 0 of e_j is replaced by bit 0 of y_j. It models a keystream truncated by one bit.
    - λ ∈ {1, 0.5, 0.2, 0.1}.
    - Derived maximum AUC: 0.5 + λ/4 = 0.75, 0.625, 0.55, 0.525.
  - **K2 (keystream reuse):** with probability λ = 0.1, e_3 uses the mask of position 0, Poseidon(K, 0). This applies to M2b-* only.
  - Detection uses the same family and rule.
  - **Void rule:** if K1 at λ = 1 is not detected for a task, that task's negative result is void.
  - **Expectations:** K1 λ ∈ {1, 0.5} detected for every task; 0.2 and 0.1 open; K2 detected for M2b-*.

## M3 — colluding verifier + corrupted ancestor
- **Features.** φ from M2, plus the verifier's view of t: method, target and amount (as numbers), params (4 bytes), now, and the submission index in the global order.
- **Tasks.** M2a-P and M2b-P.
- **Models and null.** The same 3 models and the same null.
- **Family M3.** 2 × 3 = 6 cells, Holm, same rule.
- **Sanity control.** K1 at λ = 1. Expected: fresh not detected, K1 detected.

## Reporting
- **Per family:** the decision; AUC with a 95 % cluster-bootstrap CI over test units (2,000); p; null mean and 99 % quantile; and, for M2b, top-1 accuracy.
- **Statement of the result:** "no link detected by the tested adversaries and classifiers above the measured MDE". It is never "no link".
- **Bookkeeping:** failures are kept. Any change after this commit is recorded as an amendment, with the time and the reason, before the affected run.

## Outputs
- `results/world_M.jsonl` and `results/knowledge.json`;
- `results/gen_*.stderr` and `results/verify.json`;
- `results/d3_dictionary.json`;
- `results/m1.json`, `results/m2.json`, `results/m3.json`;
- `RESULTS.md`, `RUN_RECORD.md`, `MANIFEST.sha256`.

## Amendment A1 (2026-10-14, before any analysis of the real transcripts)
**Context.** World M was being proved when this was written. The analysis has read no real transcript.
- `results/knowledge.json` exists, written by the witness phase. It has not been analysed.
- The details below were fixed while developing `analyze_e6e.py` on **synthetic** worlds with random words and the same structure. Those worlds are kept in the scratchpad and are not evidence.

1. **C1 null.** The agent labels are permuted *within each round*. Every pool agent acts exactly once per round, so this keeps the one-action-per-round structure. A transcript-level permutation across rounds would not keep it.
2. **D3.** The dictionary is the union of all adversaries' knowledge. This is a superset of every single adversary's knowledge, so a count of 0 implies 0 for each adversary. Residuals (ii) are checked against every candidate y at every position:
   - 32 / 32 / 128 / 512 candidates at positions 0..3;
   - 2,883,584 residuals in total.
3. **M2a hypotheses.** A hypothesis is represented by its own chain positions only: 0..1 for a master, 0..2 for a parent. A master's or a parent's knowledge of its descendants' keys is used in M2b, not in M2a.
4. **M2 AUC.** AUC is computed by ranks. This is identical to `roc_auc_score`, and the scores are ranked once. The B null draws use the same permutation stream for the three models.
5. **Detection with small B is impossible by construction.** With B = 200, the minimum p of 1 / 201 cannot pass Holm at 12 or 18 cells. This is why B = 5,000 was pre-registered.
6. **Synthetic checks** (development only):
   - K1 at λ = 1 gave AUC 0.73–0.77 (derived 0.75);
   - W3 at ε = 0.2 gave 0.60 (derived 0.59);
   - K2 at λ = 0.1 gave 0.55–0.57;
   - fresh synthetic gave AUC 0.48–0.52.

   One fresh synthetic cell had p = 0.01 and one had p = 0.02, both at B = 200. A second synthetic seed gave no p below 0.19 in the fresh M2a / M2b cells checked. This is consistent with chance; it was not tuned.
7. **Unchanged:** the world, the tasks, the features, the models, the splits, the families, the decision rules, the controls, B and the void rules.
