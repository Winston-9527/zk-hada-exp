# T7c — complete relation and proof mapping for v9.1: plan and pre-registration (committed and pushed BEFORE any test is written or run)

Requested by party A's handoff (2026-10-13, priority 2) and by the user (2026-10-13). Plan: `work/plans/NEXT_ROUND_PLAN_20261013.md`, WP2–WP4.
Object: main at 806b485 (v9.1 merged: PR #60, #62). Builds on T7 (`../T7-review_20261010/CLAIM_MAP.md`) and T7b (`../T7b-lean-statemachine_20261010`).
Party A's `main_sections.tex` and `security_mapping.md` are **not available to us**. The mapping is derived from the source. When the two files arrive,
they are compared clause by clause, and the differences are posted to #11. `paper.tex` is not edited.

## Deliverables
| ID | file | content |
|---|---|---|
| D1 | `RELATION_SPEC_v9_1.md` | Exact relations of the six operations: register, mint, transfer, execute, revoke, open. Each gives the public statement x, the witness w, every constraint (file:line), the contract checks (file:line), the state transition, and the assumptions. **Derived line by line from the circuits and contracts, not from the paper.** Each clause has an ID (e.g. `EX-7`) |
| D2 | `MAPPING_v9_1.md` | One row per clause: clause → circuit → contract → test or Lean theorem → evidence path → assumption → status (`tested`, `machine-checked`, `argued`, `GAP`). It also contains the leakage function L (what each operation publishes) and a list of findings |
| D3 | `GAMES_v9_1.md` | Draft security games and reductions for v9.1, for party A to review. AUTH (delegation and unforgeability), CAP, REV (with Δ), BUD (conservation), CTX (action binding), REG, REVAUTH, ANON (bounded leakage L), ACC (opening correctness and robustness), NFR (non-framing). Each reduction is written as hybrids; every step names its assumption and the clauses it uses, and is marked `full` or `sketch`. **This is a draft by party B.** It is not a verified proof and must be reviewed before it enters the paper |
| D4 | `tests/` + `results/` | Targeted tests X1–X5 for the five points party A named (below) |
| D5 | `refine/` | Executable Lean transition function with a **machine-checked** soundness lemma against T7b's `Step`, plus a differential test of contract + circuit against it (R1, below) |

D1–D3 are documents; they are written after this plan is pushed. D4 and D5 are experiments; their designs and expected results are fixed here.

## D4 — targeted tests (run locally on the Mac, as the other non-scale tests)
Every case is recorded at the levels it reaches: oracle, witness/R1CS (failing template and line), and, where stated, contract. A process error, a
missing dependency or a compile error is **not** counted as a rejection.

**X1 Ordered-tree (IMT) non-membership** (`imt.circom`, `revoke_transition.circom`)
- **X1a, exhaustive differential (harness `IMTNonMember(4)`).**
  - Universe: every subset S of {1, …, 6} (64 trees, built by the JS IMT of the generators), every query k ∈ {0, …, 8}, and every leaf of the tree, used as the low-leaf witness.
  - Oracle: there is an accepting witness ⇔ k ∉ S ∪ {0}. When k ∉ S ∪ {0}, exactly the true predecessor is accepted; every other leaf is rejected.
  - Also: 1,000 forged low leaves (random value / next fields not in the tree) are rejected.
  - Pass: 100 % agreement.
- **X1b, truncation.** key_full and key_full + 2^252 (when < p) map to the same key.
  - Expected and recorded: non-membership of one implies non-membership of the other, and revoking one revokes both.
  - This is a stated property (an honest key can only look revoked), not a failure.
- **X1c, insertion preserves the sorted list (`RevokeTransition(20)`).**
  - 200 random honest insertions, starting from the generators' genesis. After each, the tree decoded from the leaves must be a sorted linked list ending at next_value = 0.
  - Each of the following must be unsatisfiable, with its failing location recorded: (i) low leaf not the predecessor; (ii) duplicate key; (iii) next_index ≠ an empty slot; (iv) next_index = an already used slot; (v) low leaf from a stale root; (vi) new leaf with wrong next pointers.
  - Pass: every honest step keeps the invariant, and every forgery is rejected at a constraint.

**X2 Poseidon masks / KEM and domain separation**
- **X2a, static inventory.** Every Poseidon call in the v9.1 main circuit, budget_transfer, budget_mint, register and revoke_transition, plus the gate's `PoseidonT4`. The table records arity, the role of each input slot, and the constant tag if there is one.
  - Pre-declared result format: for each arity, a list of uses, and the pairs of uses that are **not** separated by a constant tag or a structural difference. Each such pair is argued in D2/D3 or listed as a finding.
- **X2b, known-answer agreement.** For arities 2, 3, 7, 8, 1,000 random inputs each must give the same output from three implementations: the circom harness (witness), circomlibjs and poseidon-lite. For arities 2 and 3, the Solidity `PoseidonT3`/`PoseidonT4` is compared as well, in forge. Pass: 100 % equal.
- **X2c, keystream structure.** For 1,000 fresh K, the D + 2 masks Poseidon(Kx, Ky, j), j = 0..D+1, are pairwise distinct. This is a sanity check; the security of the masks is an assumption (Poseidon-PRF), stated in D3.

**X3 Nullifier injectivity and canonical secrets**
- **X3a, encoding audit.**
  - budget_nf = Poseidon(TAG_BNF, sk, cm_in): sk is range-checked < l; cm_in is a Poseidon output. nf_domain = Poseidon(TAG_REG, s, domain): s < l.
  - Mutations, each expected unsatisfiable: sk + l and s + l (aliasing); sk of a different key; cm_in of a note not in the tree.
- **X3b, collision attempts.** Two different notes with the same nullifier (different q, rho, lineage or owner), and the same note with two nullifiers (other sk). Expected: neither can be built; this follows from range checks, pbk and the Poseidon arity. Recorded per case.
- **X3c, contract.** A spent nullifier reverts (`BudgetSpent`) for an action and for a transfer, and a registration nullifier cannot register a second, different leaf except through a replacement. These are cited from E7c B4, V91 tests and registration tests where they exist; otherwise new forge tests.

**X4 Committee configuration**
- **X4a.** E6c O15 is cited: off-chain TPK checks for every committee size.
- **X4b.** It is recorded what the code does today for invalid configurations: t = 0, t > n, n = 0, duplicate member index, and a Feldman commitment vector of the wrong length (`threshold.mjs` `deal`/`combine`).
  - Expected (pre-declared): there is **no** configuration validator, and the gate does not check TPK on chain (T3 A22i). These are recorded as GAPs.
  - A validator (`validCommittee`) is added and tested in this directory; the original library is not changed.

**X5 Non-framing.** Victim V is an honest key whose secret the adversary does not know.
- **X5a.** V is put at hop j = 0..D of an otherwise adversarial chain (D = 2, 4), with (i) no signature, (ii) a signature by the adversary's key, (iii) a signature replayed from another certificate of V. Expected: unsatisfiable at EdDSA (j < D), or at BabyPbk (j = D). The failing location is recorded.
- **X5b.** The ciphertext words of one of V's past actions are pasted into the adversary's own action witness. Expected: unsatisfiable (keystream equation).
- **X5c.** Forged shares naming V's committee index: E6c O6, O7, O12 are cited.

## D5 — refinement (R1)
- **R1a, Lean.** `exec : St → Op → Option St`, computable, over T7b's `St`. The theorem `exec_sound : exec s op = some s' → Step Δ s s'` is machine-checked: no `sorry`, standard axioms only (`#print axioms`).
  - A `main` driver reads an op sequence and prints the abstract state after each step.
- **R1b, differential.**
  - 1,000 random op sequences of length ≤ 20 (mint / split / delegate / execute / revoke / tick, including invalid ones: overspend, double spend, revoked lineage after Δ, unknown note).
  - Implementation side: ZkDacGateV9 with a mock verifier, plus a JS checker of the circuit's statement (the generators' oracle).
  - 50 of the sequences are re-run with real v9.1, transfer and mint proofs and the real verifiers. The mock must not hide a difference: the accept/reject results must be identical.
  - Abstraction function α: note count, spent flag per note index (via the nullifier), minted, used, and revoked entries with their times.
  - Pass: α(implementation state) = model state, and accept = `exec` ≠ none, after every step of every sequence.
- **Pre-declared abstraction differences**, not counted as failures:
  - gas;
  - Merkle paths and roots (the model has none);
  - the clock skew and the issued/registered-root windows (the model has only Δ for revocation);
  - the executor not being bound (POLICY);
  - the model's `delegate` requiring c ∉ lineage, which the circuit does not check (recorded as a finding if reachable).
- Any other difference is reported and located: model or implementation.

## Pass and reporting
- D4 and D5 pass when every pre-declared expectation holds. Differences are reported, never reclassified.
- Each finding in D2 is placed in one of three classes, following the scope rule in memory (judge by the research-design goals):
  - (a) breaks a research-design goal → fix proposal;
  - (b) a weakness that does not → disclosed;
  - (c) an abstraction choice → documented.
- Nothing in this directory is a proof of the cryptographic statements. D3 is a draft; D5 mechanizes only the non-cryptographic refinement step.
