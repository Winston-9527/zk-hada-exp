# T7c — complete relation and proof mapping for v9.1: results

Pre-registration: `PLAN.md` (ab9d535, pushed before any test was written or run). Commands: `RUN_RECORD.md`.

Object: main 806b485 (v9.1). Everything ran locally (Apple M5 Pro, node 24.14.1, circom 2.2.3, forge 1.5.1, Lean v4.31.0-rc2 + mathlib as in T7b).

**Nothing here proves the cryptographic statements.** D3 is a draft of the reductions; D4 and D5 are conformance tests. The machine-checked part is the model-level refinement step (R1a) and T7b's invariants.

## Deliverables
| ID | file | content |
|---|---|---|
| D1 | `RELATION_SPEC_v9_1.md` | Six operations with 69 clause IDs, each pointing to file and line; the leakage function L; findings F-1..F-10 |
| D2 | `MAPPING_v9_1.md` | Every clause mapped to implementation, evidence, theorem, assumption and status; gaps GAP-1..4 |
| D3 | `GAMES_v9_1.md` | 10 games (AUTH, CAP, REV, BUD, CTX, REG, REVAUTH, ANON, ACC, NFR), the lemma L-IMT, the assumptions, and the reductions as hybrids, each step marked full or sketch. **Draft for party A** |
| D4 | `tests/`, `results/x*` | X1–X5 |
| D5 | `refine/`, `results/r1_*` | R1a (Lean) and R1b (differential test) |

## D4 — targeted tests: every pre-declared expectation holds
| test | result | file |
|---|---|---|
| X1a IMT non-membership, exhaustive (64 trees × k = 0..8 × every leaf) | **2,304 / 2,304** agree with the oracle; every one of the 320 non-members has an accepting witness; **1,000 / 1,000** forged low leaves rejected | `results/x1_imt.json` |
| X1b 252-bit truncation | k and k + 2^252 are always treated alike; inserting the high alias revokes k | same |
| X1c insertion (RevokeTransition(20), generators' genesis) | **200 / 200** honest insertions satisfiable, root equal to the JS tree, sorted list intact. Forgeries UNSAT: low leaf not the predecessor 29 / 29 (IMTNonMember L59 / L67), duplicate 28 / 28, used slot 29 / 29 (L67), wrong new-leaf pointer or value 58 / 58 (L71), low-leaf path from a stale tree 28 / 28 (IMTPath L39) | same |
| X1c, the two cases left to the contract | skipped slot (next_index = count + 1) and stale old_root are **satisfiable in the circuit**, as expected, because the circuit checks only slot emptiness and its own root. Real proofs of both are **rejected by ZkDacRevocations (InvalidProof)**, because the contract supplies (current root, count) as public inputs. Honest genesis → R1 → R2 is accepted | `results/x1c_contract.txt` |
| X2a Poseidon inventory | 13 uses at 5 arities; a grep of the code (comments stripped) matches the inventory in every file. H_3 is shared by six uses: tagged pairs are separated by constants; the untagged ones live in namespaces that are never compared, or are separated structurally (argued in D3 §0) | `results/x2_poseidon.json` |
| X2b known answers | circuit = circomlibjs = poseidon-lite, **4,000 / 4,000** (arities 2, 3, 7, 8 × 1,000); Solidity PoseidonT3 / PoseidonT4 **1,000 / 1,000 each** | `results/x2_poseidon.json`, `results/x2_solidity.txt` |
| X2c keystream masks | 0 of 1,000 fresh K had a repeated mask (D + 2 masks each) | same |
| X3 nullifier injectivity, canonical secrets | all 15 mutations UNSAT, all 6 controls SAT. sk + l (action D = 2, 4; transfer; registration s + l); a second sk for the same note; another note's nf; a note not in the tree; field wrap of q (action, transfer); registration nf for another domain | `results/x3_x5.json` |
| X4 committee configuration | **today `deal` accepts t = 0, t > n, n = 0, t < 0**, and `combine` with t > n can never open; the gate stores TPK unchecked (GAP-1). The new `validCommittee` classifies **12 / 12** cases correctly (3 honest committees, 9 invalid) | `results/x4_committee.json` |
| X5 non-framing | V's key at every hop (D = 2, 4) without V's signature, with the adversary's signature, or with V's signature from another certificate: **19 / 19 UNSAT** at the EdDSA equation or at BabyPbk (terminal holder). V's ciphertext words pasted into another action: **2 / 2 UNSAT** (AccHybridCompressed L18 / L23) | `results/x3_x5.json` |

**Failure locations.** The script also compared the failing template and line against a guess that was not in the pre-registration. 20 rows differ from that guess while still being UNSAT where the pre-registration says:
- **X5a:** the guess was `EdDSAPoseidonVerifier`; the witness error names the innermost template, `ForceEqualIfEnabled L56`. In this circuit that template is used only by circomlib `eddsaposeidon.circom` lines 114 and 119, the signature equation.
- **X3a:** for a note not in the tree, the error is at `ZkDacChainV9 L223` (`note_root === bmem.out`) instead of inside `BinaryMerkleRoot`. For D = 4, sk + l exceeds 2^251 and is caught by `Num2Bits(251)` (line 195) before the `< l` check.

The raw rows are unchanged in `results/x3_x5.json`.

**Extra row, not pre-registered (finding F-2).** 0·B8 = (0, 1): holder_sk = 0 gives the identity point as the terminal key. T3 A03b covers only an *unregistered* identity hop, which is rejected at MerkleMember. An issuer that certifies O lets anyone act as that holder; the opening still names the issuer.

## D5 — refinement
**R1a (machine-checked).** `refine/Refine.lean` defines:
- `exec : St → Op → Option St`, computable over T7b's `St` (`BudgetSM.lean` copied byte-identical; sha256 309eb786…);
- `exec_sound : exec Δ s op = some s' → Step Δ s s'`;
- `exec_run_reachable`;
- `exec_run_conservation` (T1 for every `exec` run).

No `sorry`. Axioms: `propext`, `Quot.sound`, plus `Classical.choice` for the conservation corollary (`refine/check_output.txt`).

**R1b (tested).**
- Implementation: ZkDacGateV9, ZkDacRevocations and ZkDacRegistry on anvil, driven by a client that builds witnesses for the circuits' statements.
- Model: `exec`.
- Δ = 2 ticks. One tick is 1,000 s, and the revocation window is 2,500 s, which makes acceptance coincide with the model's `now ≤ t + Δ`.
- Abstraction α, read from the chain after every step: number of NoteInserted events; budgetSpent per note; totalMinted; the sum of executed amounts at the target; Revoked events with their tick.

| run | sequences | steps | α and acceptance equal | sequences with a mismatch | real witness = client predicate | wall time |
|---|---|---|---|---|---|---|
| mock verifiers | 1,000 | 11,777 | **11,777** | **0** | n/a | 469 s |
| real proofs and verifiers (v9.1 c1–c4, transfer, mint, revoke, registration) | 50 | 644 | **644** | **0** | **283 / 283** | 694 s |

Coverage of the mock run (step counts):

| operation | valid | revoked ≤ Δ (still live) | revoked > Δ | spent note | bad amount | unknown note |
|---|---|---|---|---|---|---|
| execute | 1,199 | 294 | 55 | 748 | 262 | 129 |
| split | 719 | 222 | 27 | 551 | 186 | 138 |
| delegate | 389 | 86 | 8 | 238 | 94 | — |

The run also had 3,101 mints, 1,136 revocations and 2,195 ticks. In every category, model and implementation accept and reject the same steps. The real run covers the same categories at a smaller scale (`results/r1_real.json`).

**Harness bugs in the first full run (all fixed before the reported runs; the outputs are kept):**
1. ethers' `waitForTransaction` hung on a race with anvil's automine. Receipts are now polled directly.
2. In the real run, a comment was inserted mid-line and disabled the `toV9(...)` call. The v9 conversion and `now` were therefore missing, every real execute witness failed, and 116 predicate/witness disagreements resulted (`results/r1_real_run1_harness_bugs.json`).
3. The gate's requiredCap was 0 while the instances use a different act_req_cap, so every real execute proof failed verification.

Bugs 2 and 3 do not affect the mock run, whose verifiers accept everything and which uses only fields computed before the broken line. Its two runs are identical (`r1_mock_run1.json` vs `r1_mock.json`).

## Findings (D1 §8, D2 §8): what needs a decision
| ID | finding | proposed |
|---|---|---|
| F-1 | the gate's TPK is immutable: one committee per gate deployment | disclose in the paper |
| F-2 | holder_sk = 0 allowed (terminal key = O, if an issuer certifies it) | **decision**: disclose, or add the constraint `ent[D] ≠ O` (one constraint; needs v9.2 keys and a new setup) |
| GAP-1 | no committee validator in the library; TPK unchecked on chain | `validCommittee` now exists off-chain (X4); an on-chain check at deployment is optional (**decision**) |
| GAP-2 | L-IMT / INV and implementation → Step are argued, not mechanized | next Lean target if wanted |
| GAP-3 | A-wSE (Groth16 weak simulation extractability) and A-PRF (Poseidon) are needed by the reductions and are not in the paper; the citation must be checked | party A |
| GAP-4 | party A's `main_sections.tex` / `security_mapping.md` not compared | needs the files |

F-3..F-10 are documented design or scope points (D1 §8).

## Deviations from the pre-registration
- X1c (iii) "next_index ≠ an empty slot" overlapped with (iv). Both readings were run: a used slot is UNSAT; an empty slot ≠ count is SAT in the circuit and rejected on chain.
- X3c cites existing tests (E7c B4, V91 history, REGt); no new contract test was needed. The contract-level revocation tests (`T7cRevocations.t.sol`) were added for X1c.
- R1 operation mix: mint 20 %, transfer 25 %, execute 25 %, revoke 10 %, tick 20 %. The weights were not pre-registered; they were changed once, after the 5-sequence smoke run, to cover the revoked > Δ category.
- In R1, an "unknown note" op is a note index ≥ size. Key revocation (key entries) is not generated, because the model has only lineage entries; it is covered by E3, T5b and T3 A18. Duplicate revocations are not generated: the model treats them as no-ops, while the circuit rejects them (X1c (ii)).

## Revision 2026-10-13 (appended)
F-2 was fixed by the user's decision in **v9.2** (`../../t2_circuit_fix/zkdac_v9_2/`): the constraint holder_sk ≠ 0 is added. The PoC shows F-2 on v9.1, and v9.2 closes it, both at witness level and on the gate (E7d). The text above describes v9.1 and is unchanged. For v9.2, clause EX-8 additionally reads "holder_sk ≠ 0".

## Corrections after audits #76 and #81 (2026-10-15; no new experiment — counts marked "audit" are the auditor's instrumented re-runs)
- **"283 / 283 real witness = client predicate" is overstated** (#76 F2).
  - `refine/diff.mjs:155` counts an over-amount execute as "agree" without computing a witness.
  - Audit re-run: 283 = **237 positives + 18 negatives (all TR-4 amount conservation) + 28 not computed**.
  - There are **0 revocation / non-membership negatives**, so R1b does not test the circuit's revocation predicate. T5c's citation of this number is withdrawn.
- **Mock run (#76 F3).** Rejected steps with `pred = false` were never submitted (`diff.mjs:127/139`). Audit count: 1,030 steps, 41 % of all rejected steps (bad amount, unknown note, spent + bad amount), were judged only by the client predicate.
  - Forced on chain under mock verifiers, the gate accepted 8 of 9 over-amount executes (audit). Amount conservation is therefore **not** enforced by the gate. It is enforced by the circuit: X3b, T3 A20.
  - **Corrected scope of "In every category, model and implementation accept and reject the same steps":**
    - for the implementation-side rejections (spent note through the nullifier; revoked > Δ through the window), model and chain agree;
    - every other rejection category agrees by construction of the client predicate.
  - MAPPING's references from TR-1, TR-4 and EX-13..15 to R1 are limited accordingly. Their circuit evidence is X1 / X3 / T3.
- **Other records (#81 F7):**
  - The harness-bug count is inconsistent: RUN_RECORD says 2 in the second run, this file says 3 in the "first full run". The hung run left no output, and bug 3 is not visible in the kept outputs.
  - The Δ boundary is untestable by construction: every transaction is at least 2 s away from t + 2,500. A `<` vs `<=` change in the contract would pass R1.
  - α does not compare note amounts, lineage, subtree counts, revocation roots or revocation authority. `now` is taken from the client variable.
  - PLAN:75's "is c ∈ lineage reachable" was not reported.
  - GAMES:121 "accepted transactions are Steps" needs the premise "under A-CR and a trusted operator".
- **`MANIFEST.sha256` was stale** after the 2026-10-13 revision of this file (#81 F5). It is regenerated in this commit.

## Follow-up 2026-10-16: window boundaries
- The revoked-root window boundary is tested at gate level with a real proof (`V92.t.sol:test_GB7`), and a `<=` → `<` mutation of `ZkDacRevocations` is caught.
- The gate's note-root and issued-root windows now have accept-at-boundary tests (`T7cWindowBoundary.t.sol`). These catch the `_rootOk` mutation, which the earlier suite missed.
- Details: `work/audit_corrections/FOLLOWUPS_20261016/F3_windows/`.
