# D2 — Proof mapping for v9.1: clause → implementation → evidence → theorem → assumption

One row per clause of `RELATION_SPEC_v9_1.md` (D1). Theorems and assumptions refer to `GAMES_v9_1.md` (D3). Paths are relative to `work/`.

**Status values:**
- **machine-checked**: Lean, no `sorry`, standard axioms;
- **tested**: a finite test set agrees with an independent oracle; this is not a proof;
- **argued**: paper-level argument in D1/D3;
- **GAP**: missing or not enforced.

**Evidence abbreviations:**

| abbreviation | path |
|---|---|
| T2m | `t2_circuit_fix/zkdac_v9_1/results/mutations_d*.json` (single-field mutations, D = 1..4) |
| T3 | `t3_attacks/v9_1/RESULTS_v9_1.md` (174 rows) |
| PB | `t2_circuit_fix/zkdac_v9_1/results/public_binding.json` |
| E3 | `t4_revocation/E3-revocation_20261009/RESULTS.md` |
| T5b | `t5_e2e/T5b-revocation-circuit_20261012/RESULTS.md` |
| E7b | `t4_obligations/E7b-v9-policy-closure_20261012/POLICY_CLOSURE_V9.md` |
| E7c | `t4_contracts/E7c-v91-gate_20261013/RESULTS.md` |
| E6c | `t4_accountability/E6c-opening-v91_20261013/RESULTS.md` |
| T8b | `t8_paper/T8b-v91-repro_20261013/RESULTS.md` |
| X1..X5, R1 | `t7_proofs/T7c-proof-mapping_20261013/results/` |
| L-T7b | `t7_proofs/T7b-lean-statemachine_20261010/BudgetSM.lean` (T1–T4) |
| L-R1 | `refine/Refine.lean` (`exec_sound`, `exec_run_conservation`) |
| REGt | `t4_contracts/foundry/test/V5.t.sol`, `V6.t.sol` (registration replay and replacement) |
| RVKt | `t4_contracts/foundry/test/RevokeV7R.t.sol`, `T7cRevocations.t.sol` |

## 0. Common objects
| clause | implementation | evidence | theorem / lemma | assumption | status |
|---|---|---|---|---|---|
| C-1 certificate hash | chain 119–124; reg 52–57; rvk 42–44; xfer 87–88 | T2m (cap, expiry, keys), T3 A00–A18, X2b (H_7 known answers) | AUTH, CAP | A-CR (H_7) | tested + argued |
| C-2 key entry | chain 158–167; rvk 45–46; xfer 75 | E3 (key revocation), T5b, X2a | REV | A-CR (H_3, tag) | tested + argued |
| C-3 IMT key (252 bits) | imt 12–20 | X1b (an alias is revoked together) | REV item 4 | — | tested |
| C-4 / C-5 IMT leaf and non-membership | imt 42–74 | **X1a: 2,304 / 2,304 equal to the oracle, 320 / 320 complete, 1,000 / 1,000 forged low leaves rejected** | L-IMT | A-CR, INV | tested + argued; **not mechanized** |
| C-6 note commitment | chain 214–218; xfer 44–46; mint 9–11 | X2b (H_8), X3a (note not in tree: UNSAT) | BUD item 2 | A-CR (H_8); A-PRF (iii) for hiding | tested + argued |
| C-7 budget nullifier | chain 224–225; xfer 57–58 | **X3a/b: sk + l, a second sk, another note's nf: all UNSAT (action and transfer)**; E7c B4 120 / 120 | BUD item 3, CTX | A-CR, A-PRF (ii) | tested + argued |
| C-8 state root | chain 207–208; Gate 115–119 | X2b (circuit = PoseidonT4 on chain, 1,000 / 1,000); V91 `registerStateMatchesCircuit` | — | A-CR | tested |
| C-9 registration nullifier | reg 46–48 | X3a: s + l UNSAT, other domain UNSAT; REGt | REG (a) | A-CR | tested + argued |
| C-10 context hash | Gate 94–96 | E7c B3 (target / method / params / nonce / amount / chain / gate: 120 / 120 each) | CTX | A-KEC | tested + argued |
| C-11 canonical secrets | chain 192–200; xfer 54–56; reg 28–34; rvk 50–53 | X3a (+ l aliasing UNSAT in action, transfer, registration) | BUD, REG, REVAUTH | — | tested |

## 1. REGISTER
| clause | evidence | theorem | status |
|---|---|---|---|
| RG-1..4 | X3a; registration negatives (`t4_registration`); T8b C5 (rows equal across environments) | REG | tested + argued |
| RG-C1..C4 | REGt (replay → AlreadyRegistered, old proof after replacement → LeafRetired); E7b | REG (a) | tested |

## 2. MINT
| clause | evidence | theorem | status |
|---|---|---|---|
| MI-1 | E7c (123 real mints); R1 (mints in 1,050 sequences) | BUD (T-2: the operator is trusted for owner and lineage, F-6) | tested |
| MI-C1 | V91 GB5 (non-operator), wrong amount → InvalidProof | BUD | tested |

## 3. TRANSFER
| clause | evidence | theorem | status |
|---|---|---|---|
| TR-1 note membership | X3a (rho changed: UNSAT); R1 (unknown-note ops rejected by both sides) | BUD item 2 | tested + argued |
| TR-2, TR-3 owner, nullifier | X3a/b (transfer sk + l, another note's nf) | BUD item 3 | tested |
| TR-4 conservation | X3b (q1 = q_in + 1, q2 = p − 1: UNSAT); R1 (bad-amount splits / delegations rejected) | BUD item 4; **L-T7b T1/T2 and L-R1 on the model side** | tested + argued; model machine-checked |
| TR-5, TR-6 revocation | E3, T5b, T3 A12/A13 rows (v9.1 refreshed hops) | REV (for spending); F-3 (transfer weaker) | tested |
| TR-7, TR-8 delegation edge, outputs | V91 history (S1, S4, S7, S8), R1 delegate ops | BUD; F-4 | tested |
| TR-C1..C3 | V91 GB7 (stale revoked root), test_actionThenTransferOfSameNote (shared nullifier), R1 | BUD, REV | tested |

## 4. EXECUTE
| clause | evidence | theorem | status |
|---|---|---|---|
| EX-1 continuity, EX-2 signatures | T2m; T3 A04, A05–A05c; **X5a 19 / 19 UNSAT at EdDSA / BabyPbk** | AUTH, NFR | tested + argued |
| EX-3 membership | T2m; T3 A03, A03b, A08, A09, A17a–e | AUTH | tested |
| EX-4 certificate revocation | E3 (0 false accepts, 14 / 14 ablation), T5b (301 / 301 blocked), T3 A12a–c, A13–A13c | REV + L-IMT | tested + argued |
| EX-5 key revocation (t ≥ 2) | E3, T3 A18a–i (A18d: master key entry has no effect, by design) | REV; F-8 (master / human not key-revocable) | tested |
| EX-6 expiry, attenuation | T2m, T3 A14 (now = 0 is a POLICY row, closed by the gate clock), A16 | AUTH / CAP; F-7 (clockSkew) | tested |
| EX-7 capabilities | T2m, T3 A11, A15; E7b A11-req | CAP | tested + argued |
| EX-8 holder secret | X3a/b, X5a (terminal: UNSAT at BabyPbk), T3 A02, A06; **F-2: holder_sk = 0 gives ent[D] = O** (X3 extra row). T3 A03b covers only an *unregistered* identity hop, which is rejected at MerkleMember. The registered case is accepted by construction | CTX, NFR | tested; **F-2 open (decision)** |
| EX-9, EX-10 public context, state root | PB (every public word + 1 fails); X2b; T3 A11a, A11b, A21a–c | CTX | tested |
| EX-11 KEM | E6c O13 (c1 / c2 substitution); X5b; T3 A22c, A22d, A22f, A22g | ACC, ANON (H2) | tested + argued |
| EX-12 keystream, on-curve (v9.1) | E6c O20 (120 / 120), O21 (v9 wrong exactly at the off-curve hop), E7c G7, v9.1 check 5, T3 A22a, A22b, A22e, A24 | ACC step 3, NFR | tested + argued |
| EX-13..15 note, nullifier, arithmetic | X3a/b; T3 A07, A10, A20a–i; E7c B1/B4; R1 | BUD | tested + argued; model machine-checked |
| EX-C1..C8 gate checks | E7c (73 / 73: B1–B6, G7), E7b (20 POLICY rows on v9; V91Policy 34 / 34 on v9.1), R1 | CTX, REV, BUD | tested |
| front-running (not bound) | E7c B6 (120 / 120 accepted from another sender) | — (POLICY, disclosed) | disclosed |

## 5. REVOKE
| clause | evidence | theorem | status |
|---|---|---|---|
| RV-1..3 authority | E7 `revoke/`, RVKt | REVAUTH | tested + argued |
| RV-4, RV-5 insertion | **X1c: 200 / 200 honest insertions keep the sorted list; low leaf not predecessor 29 / 29, duplicate 28 / 28, used slot 29 / 29, wrong new leaf 58 / 58, stale-tree path 28 / 28 all UNSAT** | L-IMT (INV) | tested + argued |
| RV-C1 | **X1c contract: skipped slot and stale old_root are SAT in the circuit but InvalidProof on chain** (`results/x1c_contract.txt`) | L-IMT (INV), REVAUTH | tested |
| RV-C2, RV-C3 | code (no other writer of `root`); E7c B5 Δ ∈ {0, 12, 60, 240} s; L-T7b T3 (monotonic revocation, model) | REV, REVAUTH | tested + argued; model machine-checked |

## 6. OPEN
| clause | evidence | theorem | status |
|---|---|---|---|
| OP-1, OP-2 proof check, epoch from TPK | E6c O13 (substitution refused before shares), O10 | ACC | tested |
| OP-3, OP-4 shares, DLEQ, combine | E6c O1–O12, O14, O16, O17 (2/3, 3/5, 5/9 × D = 1..4; 256 / 256) | ACC step 2, 4 | tested + argued (A-DLEQ) |
| OP-5 decoding | E6c O1-all (360 / 360), O20, O21 | ACC step 3 | tested + argued |
| OP-6 key setup | E6c O15, O17; **X4: `deal` accepts t = 0, t > n, n = 0, t < 0; there is no validator in the library, and the gate stores TPK unchecked** | ACC (T-1, T-4) | **GAP: off-chain validator added and tested (12 / 12); not enforced on chain; F-1 (TPK immutable)** |

## 7. Model refinement (BUD, REV in the abstract model)
| item | evidence | status |
|---|---|---|
| T7b `Step`: T1 conservation, T2 subtree conservation, T3 monotonic revocation, T4 freeze | L-T7b | machine-checked |
| `exec` sound w.r.t. `Step`; `exec_run_conservation` | L-R1 (`refine/check_output.txt`) | machine-checked |
| implementation ↔ `exec`, step by step (abstraction α) | R1: `results/r1_mock.json` (1,000 sequences), `results/r1_real.json` (50 sequences with real proofs and verifiers) | tested (see RESULTS.md) |
| implementation → `Step` in general | GAMES §4 item 5 | argued; **not mechanized** |

## 8. Findings and gaps
| ID | item | class | action |
|---|---|---|---|
| F-1 | TPK immutable in the gate; rotating the committee means a new gate and a new note tree | (b) | state in the paper |
| F-2 | holder_sk = 0 accepted (terminal key = O) | (b) | decision for the user: disclose, or add `ent[D] ≠ O` (one constraint, needs a new setup) |
| F-3 / F-4 / F-6 / F-9 | transfer checks less than execute; unsigned delegation edge; operator-chosen lineage; no ciphertext on transfer or revoke | (c) | documented in D1 / D3 |
| F-5 | revocation IMT capacity 2^20 | (b) | disclose |
| F-7 / F-8 | clockSkew window; master and human not key-revocable | (b) / (c) | state in the paper |
| F-10 | H_3 shared among six uses | (c) | X2a: tagged pairs separated by constants; untagged pairs live in namespaces that are never compared, or are separated structurally (curve point; different widths) |
| GAP-1 | no committee validator; TPK unchecked on chain | (b) | X4 validator (off-chain); an on-chain check at deployment is possible (decision) |
| GAP-2 | L-IMT / INV and the implementation → `Step` refinement are argued, not mechanized | — | candidate for the next Lean target |
| GAP-3 | A-wSE and A-PRF are needed but not in the paper; the A-wSE citation must be checked | — | party A |
| GAP-4 | party A's `main_sections.tex` / `security_mapping.md` not compared | — | needs the files |
