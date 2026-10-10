# E6b — linkability of v9 action transcripts (research design §7 E6 privacy part; CLAIM_MAP.md G-ANON gap) — pre-registration
Committed and pushed BEFORE any transcript is generated. Base: main d63d828.
Extends E6 U1/U2 (v7, ciphertext words only, results in ../../t4_accountability/E6-threshold-opening_20261009/RESULTS.md) to the **full v9 transcript**
in the T5 shared world. **Empirical only; not a proof of anonymity** — a negative result covers these attacks and features only; privacy rests on
Groth16 ZK, ElGamal-KEM (DDH) and Poseidon-as-PRF.

## Leakage function L (public by design, held FIXED across compared transcripts so it cannot explain a link)
D (verifier / ciphertext length) — all transcripts D = 4; action fields (target, method, amount = 1, params; nonce random per action); `now`;
roots (state_root / note_root at generation time: same snapshot for all); req_cap; TPK. Out of scope (research design): network address, gas payer,
timing side channels, gas used (a function of the note index), the auditor (holds tsk: links by design).

## Transcript = everything an observer or a colluding verifier sees per action
Groth16 proof (A, B, C: 8 field words) + the 20 public signals (state_root, now, ctx_hash, req_cap, tpk[2], c1[2], c2[2], e[0..4], e_sign, note_root,
budget_nf, cm_change, q_spent) + the three roots in calldata + the Accountability event (= the ciphertext words).

## Corpus (seeds fixed)
T5 world (`../../t5_e2e/T5-e2e-scale_20261010/state/`, 1,230 agents; offline: mirror trees, no chain). K = 64 agents at D = 4 drawn with seed
`e6b-agents`: 8 parents × 8 children under M0 / M1 (so every agent has 7 siblings in the sample; parents drawn uniformly among the 128 D = 3 nodes
with seed `e6b-parents`, then all 8 children). m = 8 sequential actions per agent, each spending the agent's current note and inserting its change
note into the mirror (as the gate would), all against one fixed snapshot of the other roots and the same `now`. 512 transcripts with real proofs
(v9 c4 zkey of the release). Fresh CSPRNG randomness for encryption, ctx nonce and change rho, as the wallet does.

## Tests
- D1 deterministic equality: any field word shared by two transcripts, within or across positions, excluding words that are constant over the
  whole corpus (state_root, now, req_cap, tpk, roots, q_spent). Expected 0.
- D2 deterministic relations: equal within-transcript differences of ciphertext words across transcripts (E6 U1 feature); budget_nf of one
  transcript equal to any cm_change / budget_nf of another. Expected 0.
- C1 same-agent pairs vs different-agent pairs (balanced), C2 sibling pairs (same parent, different agents) vs unrelated pairs (different parent
  subtree), C3 single-transcript attribute: master M0 vs M1.
  Pair features (C1, C2): for every non-constant word position and every pair of positions within the ciphertext / proof groups, the Hamming
  distance of the low 64 bits, equality of the low 16 bits, and the value of the word mod 2, 3, 5, 7 for both members; C3: low-64-bit features.
  Models: logistic regression (L2), random forest (300 trees), k-NN (k = 15) — scikit-learn 1.5.2, random_state 0.
  Split: by AGENT (train agents and test agents disjoint), 5 folds grouped by agent (C2 / C3: grouped by parent), repeated over 3 seeds.
  Metric: test ROC-AUC; 95 % bootstrap CI (2,000 resamples over test pairs); matched baseline = the same pipeline with labels permuted (100
  permutations) → permutation p-value; Holm over 3 tests × 3 models.
  **Pre-registered decision:** a link is reported if Holm-adjusted p < 0.01 AND AUC 95 % CI lower bound > 0.55 for any model; otherwise "no link
  detected by these attacks".
## Positive controls (must be detected, otherwise the pipeline has no power and the negative result is void)
- P1 ciphertext-randomness reuse per agent (the T3 A22d behaviour a careless wallet could show): same accSeed for all actions of an agent.
  Expected: D1 > 0 and C1 AUC ≈ 1.
- P2 public lineage tag: append Poseidon(cert[2]) (the parent edge) to every transcript (a design that does not hide lineage).
  Expected: C2 AUC ≈ 1.
Controls use the same generator with one change each; P1 needs new proofs (same count), P2 only appends a word.

## Outputs
results/transcripts.jsonl (512 + 512 P1), results/deterministic.json, results/classifiers.json, RESULTS.md, RUN_RECORD.md. Failures kept.
