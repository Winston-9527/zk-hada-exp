# D3 — Security games and reductions for v9.1 (DRAFT by party B, for party A's review)

**Status.** This is a draft. Nothing here has been checked by a cryptographer. Each reduction step is marked:
- **full**: the argument is complete given the named assumptions;
- **sketch**: the idea is given, but a detail (tightness, an extraction subtlety, a formal hybrid) is missing.

The clause IDs (EX-…, TR-…, RV-…, OP-…) refer to `RELATION_SPEC_v9_1.md`. Tests are cited as evidence of implementation conformance only; they are never part of a proof. `paper.tex` is not edited. Party A decides what goes into §4.

## 0. Setting and assumptions

**Parties.**
- Humans and agents hold Baby Jubjub keys.
- The operator: it accepts Semaphore group roots, mints budget and maintains the issued tree.
- The audit committee: n members, threshold t, keys from a trusted dealer.
- The verifier: the **gate contracts together with the Groth16 verifiers**. "Accepted" always means that the gate transaction succeeded. Checking the proof alone is not enough, because several clauses are enforced only by the gate (EX-C*, TR-C*, RV-C*).

**Adversary.** PPT. It can:
- corrupt agents (learning their keys) and up to t − 1 committee members (static);
- control scheduling and front-running;
- see every transaction and event.

**Assumptions.** Each one is cited per step.

| ID | assumption | note |
|---|---|---|
| A-KS | Groth16 knowledge soundness for each of the 5 circuits (action D=1..4, transfer, mint, registration, revoke), honest CRS | AGM/GGM. **The CRS in the repository is a single local phase-2 contribution: evaluation only** |
| A-wSE | Groth16 **weak simulation extractability**: extraction still works for a proof of a **new statement** after the adversary has seen proofs of other statements | Needed because honest users' proofs are public and the reduction cannot always produce them itself (it lacks the challenged key). Literature: Baghery–Kohlweiss–Siim–Volkhov, "Another look at extraction and randomization of Groth's zk-SNARK" (FC 2021). **Party A must check that the exact result applies** |
| A-ZK | Groth16 zero knowledge, honest CRS | |
| A-EUF | EdDSA-Poseidon on Baby Jubjub is EUF-CMA, with circomlib's cofactored verification (8·A) | |
| A-DL / A-DDH | discrete log / DDH in the prime-order subgroup ⟨B8⟩ | |
| A-CR | Poseidon collision resistance for widths t = 3, 4, 6, 8, 9 (arities 2, 3, 5, 7, 8), **including across widths** | X2a lists the uses |
| A-PRF | Poseidon as a PRF: (i) j ↦ H_3(K.x, K.y, j) keyed by a uniform subgroup point K; (ii) c ↦ H_3(TAG_BNF, sk, c) keyed by sk; (iii) H_8 with a uniform rho as a hiding commitment | **Non-standard; not in the paper.** It could be replaced by the ROM |
| A-DLEQ | Chaum–Pedersen DLEQ with Fiat–Shamir (SHA-512 mod l): soundness and HVZK | ROM |
| A-KEC | keccak256(·) >> 8 is collision resistant (248-bit output, about 124-bit security) | ctx binding |
| T-1..T-5 | trust: (1) honest dealer; (2) operator honest for minting and group roots; (3) correct genesis of the revocation IMT; (4) the gate deployed with a valid committee TPK (X4 `validCommittee`, F-1); (5) EVM transaction atomicity | |

**Lemma L-IMT (ordered-tree non-membership).**
- *Premise.* The leaves under root R form a sorted linked list from the sentinel (0, 0, 0), ending at next_value = 0 (invariant INV).
- *Claim.* If a witness satisfies C-5 for key k under R, then k is not a leaf value under R, except with probability Adv_CR.
- **Proof (full).**
  1. The opened low leaf is a leaf of R, by binding of the depth-20 Poseidon path (A-CR, arity 2 and 3; the leaf arity 3 differs from the node arity 2).
  2. By INV, its successor in the list is next_value: the smallest stored value larger than low.value, or none if next_value = 0.
  3. C-5 gives low.value < k < next_value, or low.value < k with low the last element. So no stored value equals k.
  4. Both comparisons use values range-checked below 2^252 (imt 54–55), so the circomlib comparators are sound.
- **INV is preserved by RV-5.** The low leaf is the predecessor, by C-5 in RV-4. It is re-pointed to k, and the new leaf takes over the old successor. The slot is empty, and the contract forces slot = count (RV-C1).
  - Status: argued.
  - Tested: X1c, 200 / 200 insertions keep the sorted list; 6 forgery classes are rejected in the circuit, 2 more by the contract.
  - Not machine-checked; this is a candidate for the next Lean target.
  - **Genesis must satisfy INV (T-3).**

## 1. AUTH — delegation unforgeability (replaces G-DEL / G-UNF)
**Game.** The challenger creates honest keys; the adversary chooses a set C of keys to corrupt. Oracles:
- Issue(i → j, cap, exp): the honest issuer i signs the certificate cert(hop, i, j, cap, exp);
- Act(h, action): the honest holder h produces a real action transaction;
- Register, Revoke.

The adversary wins if the gate accepts an EXECUTE whose extracted chain contains a hop i with ent[i] honest, such that ent[i] never signed cert[i] with those exact fields (hop, issuer, holder, cap, expiry).

**Reduction.**
1. **Extraction (sketch).** The winning transaction's proof is for a statement not previously produced by Act. Its budget_nf was unspent (EX-C6), while every Act statement has a spent nf. So A-wSE yields a witness w satisfying EX-1..15.
2. **Forgery (full).** EX-2 gives a valid signature by ent[i] on cert[i] = H_7(i, ent[i], ent[i+1], cap[i], expiry[i]). If that message was never signed by ent[i]:
   - either it is an EUF forgery (A-EUF; guess i and the honest key: loss D_max · #honest keys);
   - or it collides under H_7 with a signed message having different fields (A-CR).

Bound: Adv_AUTH ≤ Adv_wSE + D_max · N_honest · Adv_EUF + Adv_CR.

Evidence:
- T3 v9.1 chain rows (`../../t3_attacks/v9_1/RESULTS_v9_1.md`);
- X5a: V's key placed at every hop without V's signature is UNSAT at EdDSA (`results/x3_x5.json`).

## 2. CAP — capability attenuation (replaces G-CAP)
**Game.** As AUTH. The adversary wins if an accepted EXECUTE has a required capability `requiredCap[method]` that is not ⊆ cap(d) for some certificate d that an honest issuer signed for this chain. requiredCap is chosen by the gate (EX-C7), not by the prover.

**Reduction (full, given AUTH).**
- The extracted witness satisfies EX-7: act_req_cap ⊆ cap[D−1] ⊆ … ⊆ cap[0], on 32-bit decompositions.
- By AUTH, every cap[i] with an honest issuer is the signed value.
- So overreach implies breaking AUTH or A-wSE.

Bound: Adv_CAP ≤ Adv_AUTH.

## 3. REV — revocation with window Δ (replaces G-REV)
**Game.** As AUTH, with a Revoke oracle. The adversary wins if, at block time T, the gate accepts an EXECUTE whose extracted chain contains:
- a certificate cert[i] (i < D), or
- a delegate key ent[t] (t ≥ 2),

whose entry was revoked by a transaction at time t_r with t_r + Δ < T.

**Reduction.**
1. **Extraction (sketch, A-wSE).** It gives a non-membership witness for the entry under the proof's revoked_root R (EX-4, EX-5).
2. **Contract (full).** EX-C4 and RV-C3 give: R = the current root, or a root retired at a time t_R ≥ T − Δ.
   - RV-C2: roots change only by insertion, so R is the root after all revocations made before t_R.
   - Since t_r < T − Δ ≤ t_R, the entry is in R.
3. **L-IMT.** Membership of the entry in R contradicts the non-membership witness, except with probability Adv_CR.
4. **Truncation.** IMT keys are the low 252 bits (C-3). Two entries that differ only above bit 252 are revoked together (X1b). This can only revoke more, never less.

Bound: Adv_REV ≤ Adv_wSE + Adv_CR.

**What is not covered** (state it in the paper):
- the master ent[1] and the human ent[0] are not key-revocable; masters are replaced by re-registration (F-8);
- Δ, clockSkew and rootWindow are explicit acceptance windows (F-7).

Evidence: E3, T5b, E7c B5 (Δ = 0 / 12 / 60 / 240 s), X1.

## 4. BUD — budget conservation (new; research design Q2)
**Game.** The adversary schedules any interleaving of mint, transfer, execute and revoke, and corrupts any agents. Let:
- M = Σ q over accepted MINTs;
- U = Σ q_spent over accepted EXECUTEs.

The adversary wins if U > M. Subtree version: for an entry c, it wins if the amount executed through notes whose lineage contains c exceeds the amount minted or delegated into c.

**Reduction.**
1. **Extraction (sketch, A-wSE / A-KS).** Every accepted TRANSFER and EXECUTE has a witness.
2. **Note binding (full).**
   - The input note cm_in is a leaf of an accepted note root (TR-1 / EX-13; Merkle binding, A-CR). That root is a historical root of the gate's append-only tree (TR-C2 / EX-C6), so cm_in was inserted by an earlier accepted MINT, TRANSFER or EXECUTE.
   - By A-CR (H_8), cm_in opens to exactly the (own, q, lin, rho) with which it was created, so q_in is that note's amount.
3. **Single spend (full).**
   - nf = H_3(TAG_BNF, sk, cm_in) with sk canonical and sk·B8 = own (TR-2..3, EX-8, EX-14). One own has exactly one canonical sk, so each note has exactly one nf.
   - X3a: sk + l is UNSAT. X3b: a second nf for the same note, or the nf of another note, is UNSAT.
   - The gate rejects a repeated nf (EX-C6, TR-C2). Two different notes have different cm, hence different nf, unless an H_3 or H_8 collision occurs (A-CR).
4. **Arithmetic (full).** q_in = q_out1 + q_out2 (TR-4) or q_in = q_spent + q_change (EX-15), as integers: 64-bit ranges and a sum < p. X3b: the field-wrap attempts are UNSAT.
5. **Refinement to the model.** Items 2–4 say that the gate's accepted transactions are `Step`s of T7b's model, with notes = tree leaves and spent = nullifier set. The window clause `live` corresponds to REV (§3).
   - The model side is **machine-checked**: `exec_sound`, `exec_run_reachable`, `exec_run_conservation` (`refine/Refine.lean`), and T1 / T2 in T7b. T1 gives U + unspent = M; T2 gives the subtree version.
   - **Status of the step "implementation → Step": argued (above) + tested (R1, `results/r1_*.json`). It is not a mechanized refinement proof.**

Bound: Adv_BUD ≤ (#transactions) · Adv_wSE + Adv_CR, plus the trust in the operator's mints (T-2).

Notes:
- **Transfers check less than execute** (F-3). A note on a branch with a revoked ancestor key can move but never be spent. The model therefore counts it as unspent mass, which keeps conservation.
- Notes delegated to a child that has no certificate are stuck (F-4).

## 5. CTX — action binding and single use (new)
**Game.** An honest holder h produces an action transaction for action a = (chain, gate, method, target, params, amount, nonce). The adversary wins if the gate executes an action a' ≠ a while consuming h's note, without h's key being corrupted.

**Reduction.**
- The gate recomputes ctx = keccak(a') >> 8 and requiredCap(method′) itself (EX-C7).
- If a' ≠ a, then ctx' ≠ ctx (A-KEC) or the cap differs. The accepted proof is then for a new statement, and A-wSE extracts a witness with holder_sk for h's key (EX-8). That breaks A-DL.

Single use: the nullifier is spent (EX-C6); E7c B4 (120 / 120) and V91 replay tests.

**Not covered.** Submission of the *same* action by another sender (front-running) is allowed by design: msg.sender is not bound (POLICY; E7c B6).

Bound: Adv_CTX ≤ Adv_KEC + Adv_wSE + Adv_DL. Status: **sketch**.

Evidence: E7c B3, 1,440 / 1,440 substitutions rejected; T3 A23.

## 6. REG — one master per human and domain (new)
**Game.** The adversary wins if:
- (a) two different leaf0 are current in the registry for the same human and domain, or
- (b) a leaf0 naming an honest human key is registered without that human.

**Reduction.**
- (a) **Full** (code): nf_dom = H_3(TAG_REG, s, domain) with s canonical (RG-1, RG-3; X3a: s + l is UNSAT). One human therefore has one nf per domain. Reg maps nf to a single current leaf; replacement retires the old one forever (RG-C2, RG-C3).
- (b) **Sketch**: A-wSE extracts s with s·B8 equal to the human key. That breaks A-DL.

Trust: the group roots (T-2) define who is a human.

## 7. REVAUTH — only an authority can revoke, and revocation is permanent (new)
**Game.** The adversary wins if the revocation set gains an entry when none of the following is corrupted:
- the issuer and the holder of that certificate;
- for a key entry, the key itself.

It also wins if an entry leaves the set.

**Reduction.**
- Entering the set requires an accepted revoke proof (RV-C1). A-wSE extracts sk with sk·B8 equal to the issuer, the holder or the key (RV-2, RV-3). That breaks A-DL.
- An entry cannot leave the set: RV-C2 has no other writer of `root`, and RV-5 only inserts (code). So that part is **full** by code inspection.

Evidence: E7 `revoke/`, RevokeV7R, and X1c (contract-level stale-root and skipped-slot rejection).

## 8. ANON — unlinkability with bounded leakage L (replaces G-ANON)
**Game.** The adversary chooses two worlds W0 and W1 with identical leakage L (`RELATION_SPEC` §7). In particular these are equal across the two worlds:
- D;
- the roots;
- the action fields, amounts and times;
- which notes are spent;
- the revocation entries.

The holders on the challenge paths are honest. The adversary may corrupt other agents, the gate, the verifier and fewer than t committee members. It sees all transactions of W_b and must guess b.

**Hybrids (sketch).**
- H0: the real transcript.
- H1: every honest Groth16 proof is simulated (A-ZK). The proofs no longer depend on witnesses.
- H2: (c1, c2) is replaced by the encryption of an independent random point K′ (A-DDH: ElGamal KEM). K is still used for the masks.
- H3: the masks H_3(K, j), j = 0..D+1, are replaced by uniform values (A-PRF (i), since K is now independent of the transcript). Then e and esign are uniform.
- H4: budget_nf is replaced by a uniform value (A-PRF (ii); the holder's sk is unknown to the adversary). cm_change and the transfer outputs are replaced by uniform values (A-PRF (iii), since rho is fresh).
- In H4 the transcript is a function of L only, so it is identical in W0 and W1.

Bound: Adv_ANON ≤ q · (Adv_ZK + Adv_DDH + Adv_PRF(i) + Adv_PRF(ii) + Adv_PRF(iii)), where q is the number of transactions.

**What L contains, and what it does not hide** (state these in the paper):
- **D** (the verifier is chosen by ciphertext length).
- Amounts and times. A corrupted ancestor knows the amounts it delegated, so amount and timing correlation is inside L. This is the remaining Q4 question, to be measured in WP10/11.
- Revocation entries are unsalted: anyone holding a certificate or key recognises its entry (E3 L2/L3).
- The network and the gas payer.
- **Not hidden from the committee:** t members open everything (by design).

Evidence (not proof): E6b and E6b2, no link detected; the minimum detectable effect is to be measured (WP10).

## 9. ACC — opening correctness and robustness (replaces T-NFF's reduction)
**Claim.** For every accepted EXECUTE, an opening run by a committee with at least t honest members outputs exactly the chain keys ent[0..D] of the extracted witness. Every share that deviates is identified.

**Reduction.**
1. **Extraction (sketch, A-wSE).** The witness satisfies:
   - EX-11: (c1, c2) = (r·B8, K + r·tpk), with tpk the gate's TPK (EX-C7) = A_0 of the dealt committee (T-4);
   - EX-12: every ent[j] is **on curve** (v9.1), e[j] = y_j + H_3(K, j), and esign packs the canonical parities.
2. **Shares (full, A-DLEQ).** A share accepted by the combiner has D_i = s_i·c1, except with probability about 1/l per share (OP-4). Lagrange interpolation in the group gives S = tsk·c1, and K = c2 − S exactly.
3. **Decoding (full).** y_j = e[j] − H_3(K, j). The parity word is exact, so bits < 2^{D+1} (OP-5). Because ent[j] is on the curve, the two curve points with this y are ±x, and they have different canonical parity (x ≠ 0). When x = 0 the point is O or the order-2 point, and decoding still returns it. So (y_j, parity) determines ent[j] uniquely.
4. **Robustness (full).** Deviating shares fail DLEQ or the index, epoch and event checks and are blamed. Fewer than t shares give INSUFFICIENT. Shares from another epoch or event are rejected (O8–O11).

**Why v9 failed (#53).** Without the on-curve premise in step 3, an off-curve ent[j] decodes to a different on-curve point. v9.1 adds the premise (EX-12).

Evidence:
- E6c, 256 / 256, including O20 (120 / 120 openings of ciphertexts emitted by the gate) and O21 (the v9 off-curve proof opens to the wrong key exactly at the off-curve hop);
- E7c G7.

## 10. NFR — non-framing (new; party A's priority 2)
**Game.** V is an honest key that is never corrupted. The adversary wins if an accepted EXECUTE, opened by an honest committee, names V at a hop j at which V did not act:
- for j < D, V never signed cert[j] with those fields;
- for j = D, V never produced this action.

**Reduction.**
1. By ACC, the opened keys equal the extracted witness ent.
2. If j < D, the witness contains V's valid signature on cert[j] (EX-2). That is an A-EUF forgery, or an A-CR collision.
3. If j = D, the witness contains holder_sk with holder_sk·B8 = V (EX-8). That breaks A-DL.
4. Pasting V's old ciphertext words into another action is UNSAT (EX-11, EX-12; X5b).

Bound: Adv_NFR ≤ Adv_ACC + N_honest · D_max · Adv_EUF + Adv_DL + Adv_CR. Status: **sketch** (inherits A-wSE).

**v9 note.** Without the on-curve premise, the decoded key at an off-curve hop is not the signer's key (O21). Whether an adversary can make that decoded key equal a chosen victim's key was **not tested**. v9.1 removes the question.

Evidence: X5a, 19 / 19 UNSAT at EdDSA (circomlib `ForceEqualIfEnabled`, which only `EdDSAPoseidonVerifier` uses in this circuit) or at BabyPbk (D = 2, 4; every hop; no signature / the adversary's signature / V's signature replayed from another certificate, where such a certificate exists); X5b, 2 / 2 UNSAT; E6c O6, O7, O12.

## 11. What is machine-checked, what is argued, what is assumed
| item | status |
|---|---|
| T1 conservation, T2 subtree conservation, T3 monotonic revocation, T4 freeze (abstract model) | machine-checked (T7b) |
| `exec` sound w.r.t. `Step`; T1 for `exec` runs | machine-checked (T7c R1a: no sorry, axioms propext, Quot.sound, Classical.choice) |
| implementation → `Step` (refinement) | argued (§4 item 5) + tested (R1) |
| L-IMT, INV preservation | argued + tested (X1); not mechanized |
| every cryptographic step (extraction, EUF, DDH, PRF, DLEQ) | paper-level sketch here; assumptions listed in §0 |
| concrete security | not computed. BN254 is about 100–110 bits after exTNFS. ⟨B8⟩ gives about 125 bits generic DL. keccak >> 8 gives about 124 bits collision resistance (T7 CLAIM_MAP §1) |
