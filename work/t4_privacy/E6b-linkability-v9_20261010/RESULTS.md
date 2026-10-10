# E6b — linkability of v9 action transcripts — results
Pre-registration: `PREREGISTRATION.md` (b8a71c1, before any data), amendment A1 (cbe5594, before the full classifier run).
Data: `results/transcripts_{fresh,p1,p2}.jsonl` (gen.mjs, verify_and_tag.mjs); analysis: `analyze.py` → `results/deterministic.json`,
`results/classifiers.json` (100 permutations, 3 seeds, 24 min).

## Verdict
**No link was detected between v9 transcripts by any pre-registered attack:**
- same agent across actions;
- sibling agents (same parent);
- which master an agent belongs to.

**Both positive controls were detected by every test and every model**, so the pipeline has power against the leaks it targets. This is evidence
against these attacks and features only. Anonymity rests on Groth16 zero-knowledge, ElGamal-KEM (DDH) and Poseidon as a PRF, which are assumptions,
not results of this experiment.

## Corpus
- 64 agents at D = 4 in the T5 world (8 parents × 8 children under M0 and M1, all unrevoked), 8 sequential actions each.
- Every action spends the agent's current note and inserts its change note.
- 512 transcripts with real proofs: proof + 20 public signals + the three calldata roots. 512 / 512 proofs verify (`results/verify.json`).
- 9 of 31 word positions are constant by construction, because L is held fixed: state_root, now, req_cap, TPK, q_spent and the roots. The other 22
  positions are tested.

## Deterministic tests (`results/deterministic.json`)
| | fresh (v9 wallet) | P1 randomness reuse | P2 public lineage tag |
|---|---|---|---|
| word values shared by ≥ 2 transcripts (D1) | **0** | 640 (= 64 agents × 10 ciphertext words) | 8 (= 8 parent tags) |
| equal ciphertext differences across transcripts (D2) | **0** | 2,880 | 0 |
| budget_nf equal to any cm_change | 0 | 0 | 0 |
| distinct budget nullifiers | 512 / 512 | 512 / 512 | 512 / 512 |

## Classifiers (`results/classifiers.json`; test ROC-AUC pooled out-of-fold [95 % CI], within-fold AUC, Holm-adjusted unit-level permutation p)
| task | logreg | random forest | k-NN | decision |
|---|---|---|---|---|
| C1 same agent, seed 0 | 0.527 [0.494, 0.562] · 0.529 · p 1 | 0.522 [0.486, 0.556] · 0.520 · p 1 | 0.515 [0.481, 0.550] · 0.510 · p 1 | no link |
| C2 siblings, seed 0 | 0.471 [0.428, 0.513] · 0.489 · p 1 | 0.421 [0.384, 0.460] · 0.496 · p 1 | 0.499 [0.458, 0.538] · 0.519 · p 1 | no link |
| C3 master, seed 0 | 0.290 · 0.520 · p 1 | 0.043 · 0.484 · p 1 | 0.149 · 0.494 · p 1 | no link (see A1) |
| **P1 control (C1)** | 1.000 [1.000, 1.000] | 1.000 [1.000, 1.000] | 1.000 [1.000, 1.000] | detected (p = 1/101) |
| **P2 control (C2)** | 1.000 [1.000, 1.000] | 1.000 [1.000, 1.000] | 0.976 [0.966, 0.983] | detected (p = 1/101) |

- Seeds 1 and 2 give the same decisions: all 9 tests "no link detected", all 6 controls detected.
- Across the 3 seeds, the largest CI lower bound for C1 / C2 is 0.494; the decision threshold is 0.55.

**Below-chance AUCs are the grouped-CV artefact (amendment A1), not information.**
- C3 has only 8 parents (4 per master). The pooled AUCs (0.04–0.37) match the unit-level permutation null means (0.13–0.36): p 0.40–0.81.
- Within-fold AUCs are 0.46–0.52.
- C2 random forest (pooled 0.41–0.42) behaves the same way: its within-fold AUC is 0.49.

## Deviations
1. **Amendment A1** (unit-level permutation null + within-fold AUC). Committed before the full run, after a 2-permutation timing run showed the
   artefact. The timing run's output is not kept as evidence (it is superseded); its pooled AUCs are identical to seed 0 of the full run, because
   the pipeline is deterministic.
2. Proof words come from the Solidity calldata export (hex). The first analysis call failed on parsing, and was fixed with `int(x, 0)` before any
   result was produced.
3. numpy 2.1 with Accelerate prints spurious matmul RuntimeWarnings on macOS. They are suppressed in analyze.py; all AUCs are finite.

## Limits
- One depth (D = 4), one snapshot, and the action fields held equal.
- Real deployments leak through the out-of-scope channels: action fields and amounts, timing, the gas payer, the network.
- The auditor links by design.
- Revocation entries leak as disclosed in E3 (L2, L3).
- 64 agents and 512 transcripts: a weak statistical link (AUC < 0.55) would not be detected at this size.
