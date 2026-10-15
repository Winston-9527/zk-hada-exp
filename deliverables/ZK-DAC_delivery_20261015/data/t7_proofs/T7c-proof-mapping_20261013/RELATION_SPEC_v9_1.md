# D1 — Relations of v9.1 (derived from the source)

Object: main at 806b485.

How this file was written:
- Every clause was read from the circuits and contracts listed below. Line numbers refer to that commit. Nothing was taken from paper.tex.
- Clause IDs are cited by `MAPPING_v9_1.md` and `GAMES_v9_1.md`.
- Field: F_p, where p is the BN254 scalar field. Curve: Baby Jubjub; B8 = Base8; prime subgroup order l ≈ 2^250.6. H_n = circomlib Poseidon with n inputs.

| short name | file |
|---|---|
| `chain` | `work/t2_circuit_fix/zkdac_v9_1/circuits/zkdac_chain_v9.circom` (main circuit, `main_c_d{1..4}.circom` instantiate D = 1..4 with MD = 16, RD = 20, RT = 20, NT = 20) |
| `acc` | `work/t2_circuit_fix/zkdac_v9_1/circuits/accountability_v9.circom` (+ `ElGamalEnc` in `work/t2_circuit_fix/zkdac_v7/circuits/accountability.circom`) |
| `imt` | `work/t2_circuit_fix/zkdac_v7/circuits/imt.circom` |
| `xfer` / `mint` | `work/t2_circuit_fix/zkdac_v8/circuits/budget_transfer.circom` / `budget_mint.circom` |
| `reg` | `work/t4_registration/circuits/register.circom` (main: `main_reg_20.circom`) |
| `rvk` | `work/t4_obligations/E7-obligations_20261009/revoke/circuits/revoke_transition.circom` |
| `Gate` | `work/t4_contracts/foundry/src/ZkDacGateV9.sol` (unchanged for v9.1; v9.1 verifiers `Groth16VerifierV91CD{1..4}.sol`) |
| `Reg` / `Rev` | `ZkDacRegistry.sol` / `ZkDacRevocations.sol` (same directory) |
| `thr` | `work/t4_accountability/E6-threshold-opening_20261009/threshold.mjs` (off-chain opening) |

Every circuit is checked by a snarkjs Groth16 verifier contract. That verifier also rejects public inputs ≥ p.

## 0. Common objects
| ID | object | definition | source |
|---|---|---|---|
| C-1 | certificate hash | cert(i, A_i, A_{i+1}, cap, exp) = H_7(i, A_i.x, A_i.y, A_{i+1}.x, A_{i+1}.y, cap, exp); i = hop index | chain 119–124; reg 52–57 (i = 0); rvk 42–44; xfer 87–88 (i = d) |
| C-2 | key entry | key(A) = H_3(KEY_TAG = 2053861995, A.x, A.y) | chain 158–167; rvk 45–46; xfer 75 |
| C-3 | IMT key | k = low 252 bits of a field element (canonical bits, no aliasing) | imt 12–20 |
| C-4 | IMT leaf | H_3(value, next_index, next_value); sorted linked list from sentinel (0, 0, 0); next_value = 0 marks the largest element | imt 3–5, 69–70 |
| C-5 | IMT non-membership | ∃ leaf `low` on a path to root: low.value < k ∧ (k < low.next_value ∨ low.next_value = 0); both values range-checked < 2^252 | imt 42–74 |
| C-6 | note | cm = H_8(own.x, own.y, q, lin[0..3], rho); lin[j] = cert[j] for j < D, else 0 | chain 214–218; xfer 44–46; mint 9–11 |
| C-7 | budget nullifier | nf = H_3(TAG_BNF = 2053857902, sk, cm) | chain 224–225; xfer 57–58 |
| C-8 | state root | sr = H_3(issued_root, revoked_root, root_root) | chain 207–208; Gate 115–119 (PoseidonT4) |
| C-9 | registration nullifier | nf_dom = H_3(TAG_REG = 2053858418, s, domain) | reg 46–48 |
| C-10 | context hash | ctx = keccak256(abi.encode(chainid, gate, method, target, params, amount, nonce)) >> 8 | Gate 94–96 |
| C-11 | secret scalar | sk ∈ [0, l): Num2Bits(251) ∧ sk < l; public key = sk·B8 (BabyPbk) | chain 192–200; xfer 54–56; reg 28–34; rvk 50–53 |

## 1. REGISTER (human → master)
**Statement x** = (group_root, domain, nf_dom, leaf0).
**Witness w** = (s, master, cap0, expiry0, depth, index, siblings).

| ID | constraint | source |
|---|---|---|
| RG-1 | s canonical (C-11); A = s·B8 | reg 28–34 |
| RG-2 | H_2(A.x, A.y) is a leaf of the LeanIMT `group_root`, depth ≤ 20 | reg 35–44 |
| RG-3 | nf_dom = H_3(TAG_REG, s, domain) | reg 46–48 |
| RG-4 | cap0 < 2^32, expiry0 < 2^64; leaf0 = cert(0, A, master, cap0, expiry0) | reg 50–57 |

The EdDSA signature on cert0 is **not** checked here; it is checked in every action (EX-2).

| ID | contract check / transition (`Reg.register`) | source |
|---|---|---|
| RG-C1 | the operator accepts group_root; domain is fixed at deployment | Reg 44–47, 51, 55 |
| RG-C2 | first registration: leaf0 is inserted into the registered-root LeanIMT. Re-registration (same nf_dom, new leaf0): the old leaf is replaced in place and marked `retired` forever | Reg 52–57 |
| RG-C3 | the same nf_dom with the same leaf0 reverts; a retired leaf0 can never be re-registered | Reg 53–54 |
| RG-C4 | rootAccepted(r) ⇔ r ≠ 0 ∧ (r = current ∨ retired less than `rootWindow` ago) | Reg 64–69 |

## 2. MINT (operator → note)
**Statement x** = (cm, q). **Witness w** = (own, lin[4], rho).

| ID | constraint | source |
|---|---|---|
| MI-1 | q < 2^64; cm = H_8(own, q, lin, rho) | mint 8–11 |
| MI-C1 | only the operator; cm, q < p; totalMinted += q; cm inserted into the note LeanIMT | Gate 153–158 |

The operator is trusted for funding and for the owner and lineage fields, which the circuit does not check (finding F-6).

## 3. TRANSFER (split or delegate one note into two)
**Statement x** = (note_root, revoked_root, nf, cm1, cm2).
**Witness w** = (own, q_in, lin[4], rho_in, sk, note path, IMT witnesses per lineage slot and for the owner key, o1, q1, rho1, delegate, q2, rho2, cap, expiry).

| ID | constraint | source |
|---|---|---|
| TR-1 | cm_in = H_8(own, q_in, lin, rho_in) is a leaf of LeanIMT `note_root`, depth ≤ 20 | xfer 44–51 |
| TR-2 | sk canonical, own = sk·B8 (owner) | xfer 54–56 |
| TR-3 | nf = H_3(TAG_BNF, sk, cm_in) | xfer 57–58 |
| TR-4 | q_in, q1, q2 < 2^64 and q_in = q1 + q2 (integer equality, since the sum is < p) | xfer 61–63 |
| TR-5 | the active lineage slots (lin[j] ≠ 0) form a prefix; every active slot is not in the revocation IMT `revoked_root` (C-5) | xfer 66–73 |
| TR-6 | key(own) is not in the revocation IMT | xfer 75–78 |
| TR-7 | delegate ∈ {0, 1}. delegate = 0 ⇒ o1 = own. delegate = 1 ⇒ a free slot exists, and lin1 = lin with cert(d, own, o1, cap, expiry) at the first free slot d (cap < 2^32, expiry < 2^64) | xfer 81–94 |
| TR-8 | cm1 = H_8(o1, q1, lin1, rho1); cm2 = H_8(own, q2, lin, rho2) | xfer 95–100 |

| ID | contract check / transition (`Gate.transferBudget`) | source |
|---|---|---|
| TR-C1 | revoked_root accepted by `Rev` (current, or retired ≤ Δ ago) | Gate 146 |
| TR-C2 | note_root current, or retired ≤ noteWindow ago; nf < p; nf unspent → mark spent | Gate 147, 108–113 |
| TR-C3 | cm1, cm2, revoked_root < p; the proof verifies; insert cm1 then cm2 | Gate 148–150 |

**Not checked by TRANSFER** (all are checked when the note is spent by EXECUTE; findings F-3, F-4):
- expiry of the lineage certificates;
- issued-tree membership of the certificates;
- the delegate certificate's signature;
- revocation of ancestor keys.

## 4. EXECUTE (action, D = 1..4)
**Statement x** = (state_root, now, ctx_hash, act_req_cap, tpk[2], c1[2], c2[2], e[D+1], esign, note_root, budget_nf, cm_change, q_spent). That is D + 16 field elements.

**Witness w** contains:
- the issued, revoked and root roots;
- ent[0..D];
- the signatures, caps, expiries and Merkle/IMT witnesses;
- holder_sk;
- the KEM randomness r and the point K;
- the input note (q_in, rho_in, path) and q_change, rho_change.

| ID | constraint | source |
|---|---|---|
| EX-1 | cert[i] = cert(i, ent[i], ent[i+1], cap[i], expiry[i]) for i < D (C-1). Continuity is structural: holder i = issuer i+1 | chain 118–124, 183 |
| EX-2 | EdDSA-Poseidon signature by ent[i] on cert[i] verifies, for every i < D. circomlib requires 8·ent[i] ≠ O; on-curve is not checked here (see EX-12) | chain 126–130 |
| EX-3 | cert[0] is a leaf of LeanIMT `root_root` (depth ≤ 20); cert[i] for i ≥ 1 is in the issued tree `issued_root` (depth 16, boolean path); hop 0's issued-tree witness is forced to 0 | chain 132–138, 148–155 |
| EX-4 | for every i < D, cert[i] is not in the revocation IMT `revoked_root` (C-5) | chain 140–143 |
| EX-5 | for t = 2..D, key(ent[t]) is not in the revocation IMT. For D = 1 the slot is forced to 0. **ent[0] (human) and ent[1] (master) are not key-checked**: the master is revoked by re-registration (RG-C2) | chain 157–173 |
| EX-6 | now ≤ expiry[i] for every i (64-bit); expiry[i+1] ≤ expiry[i] (attenuation) | chain 145–146, 188 |
| EX-7 | cap[i+1] ⊆ cap[i] (32-bit masks); act_req_cap ⊆ cap[D−1] | chain 59–65, 187, 203–204 |
| EX-8 | holder_sk canonical (C-11) and holder_sk·B8 = ent[D] | chain 192–200 |
| EX-9 | ctx_hash is a public input (bound by squaring) | chain 205 |
| EX-10 | state_root = H_3(issued_root, revoked_root, root_root) | chain 207–208 |
| EX-11 | KEM: K on curve (BabyCheck); r < 2^251; (c1, c2) = (r·B8, K + r·tpk) | acc 16–18; ElGamalEnc |
| EX-12 | for j = 0..D: ent[j] on curve (BabyCheck, **v9.1**); e[j] = ent[j].y + H_3(K.x, K.y, j); esign = Σ_j bit0(canonical ent[j].x)·2^j + H_3(K.x, K.y, D+1) | acc 19–28 |
| EX-13 | the input note cm_in = H_8(ent[D], q_in, lin, rho_in), with lin[j] = cert[j] (j < D), is a leaf of `note_root` (depth ≤ 20) | chain 214–223 |
| EX-14 | budget_nf = H_3(TAG_BNF, holder_sk, cm_in) | chain 224–225 |
| EX-15 | q_in, q_spent, q_change < 2^64; q_in = q_spent + q_change; cm_change = H_8(ent[D], q_change, lin, rho_change) | chain 226–231 |

| ID | contract check / transition (`Gate.execute`) | source |
|---|---|---|
| EX-C1 | the ciphertext length selects the verifier (D); the method is enabled; amount, nonce < p | Gate 127–129 |
| EX-C2 | q_spent = act.amount | Gate 130 |
| EX-C3 | state_root = stateOf[keccak(issued, revoked, root)] (registered, permissionless, H_3 on chain) | Gate 131, 115–119 |
| EX-C4 | issued root current or retired ≤ issuedWindow ago; revoked root accepted by `Rev` (≤ Δ); root_root accepted by `Reg` (≤ rootWindow) | Gate 132–134 |
| EX-C5 | now ≤ block.timestamp ≤ now + clockSkew | Gate 135 |
| EX-C6 | note_root current or retired ≤ noteWindow ago; budget_nf < p and unspent → mark spent | Gate 136, 108–113 |
| EX-C7 | public inputs assembled by the gate: (sr, now, ctx(act), requiredCap[method], **tpk fixed at deployment**, ct, note_root, budget_nf, cm_change, q_spent); the proof verifies | Gate 120–125, 137 |
| EX-C8 | cm_change inserted; business call `target.onAuthorized(method, amount, params)`. If it reverts, the whole transaction reverts. Events `Executed`, `Accountability(nf, ct)`, `BudgetUsed` | Gate 138–142 |

**Not bound** (POLICY, disclosed):
- msg.sender, so another sender can front-run a pending proof;
- the gas payer.

## 5. REVOKE (authorized insertion into the revocation IMT)
**Statement x** = (old_root, new_root, entry, next_index).
**Witness w** = (kind, who, hop, ia, ha, cap, expiry, sk, low leaf, paths).

| ID | constraint | source |
|---|---|---|
| RV-1 | kind, who ∈ {0, 1}; kind = 0 ⇒ who = 0 | rvk 40–41 |
| RV-2 | entry = cert(hop, ia, ha, cap, expiry) if kind = 1; entry = key(ia) if kind = 0 | rvk 42–47 |
| RV-3 | sk canonical and sk·B8 = (who = 1 ? ha : ia). So the issuer or holder of the certificate may revoke it, and only the key itself may revoke a key entry | rvk 48–53 |
| RV-4 | trunc(entry) is not in old_root (C-5) | rvk 56–59 |
| RV-5 | low leaf re-pointed to (low.value, next_index, k); slot next_index is empty (leaf 0) in the intermediate tree; new leaf (k, low.next_index, low.next_value) written there gives new_root | rvk 60–71 |

| ID | contract check / transition (`Rev.revoke`) | source |
|---|---|---|
| RV-C1 | new_root, entry < p; the proof verifies against (current root, new_root, entry, count) | Rev 25–28 |
| RV-C2 | the old root is retired at block.timestamp; root := new_root; count += 1. There is no other writer of `root` (monotonic, append-only); genesis root and count are trusted | Rev 29–31, 23 |
| RV-C3 | rootAccepted(r) ⇔ r = root ∨ retired ≤ Δ (`window`) ago | Rev 33–35 |

## 6. OPEN (threshold opening; off-chain)
Inputs: one action's public signals and proof, as emitted by `Gate.execute` and read from its calldata and events.

| ID | step | source |
|---|---|---|
| OP-1 | the auditor verifies the Groth16 action proof with the VK for D; it refuses if verification fails | E6 `cases.mjs` `present`; E6c `lib_v91_open.mjs` `present` |
| OP-2 | epoch = the committee whose TPK equals tpk in the public signals; event id ev = SHA-256("zkdac-e6-ev-v1" ‖ public signals) | same |
| OP-3 | member i (Feldman-checked share s_i) checks: epoch matches; tpk matches; c1 is a valid prime-order point ≠ O. It releases D_i = s_i·c1 with a Chaum–Pedersen DLEQ proof (Fiat–Shamir, SHA-512 mod l) bound to (epoch, ev, i, Y_i, c1, D_i) | thr 71–82, 34–38, 57–60 |
| OP-4 | combiner: index range and uniqueness, epoch, ev, arity, valid D_i, DLEQ against Y_i. Invalid shares are blamed. With ≥ t valid shares, S = Σ λ_i D_i (Lagrange at 0, in the group); fewer gives INSUFFICIENT. The combiner never sees s_i | thr 90–117 |
| OP-5 | K = c2 − S; y_j = e[j] − H_3(K, j); bits = esign − H_3(K, D+1) (must be < 2^{D+1}); x_j from y_j and its parity bit | lib_v9 `openWithS` |
| OP-6 | key setup: trusted dealer; Feldman commitments A_k; TPK = A_0; Y_i = s_i·B8. **No DKG**; TPK validity (A22i) is checked off-chain only (`checkTpk`); the gate stores tpk immutably, so changing the committee means deploying a new gate | thr 40–55; Gate 77–78 |

## 7. Leakage function L (what each operation publishes)
| operation | published (beyond the transaction envelope: sender, gas payer, time) |
|---|---|
| REGISTER | group_root, domain, nf_dom, leaf0 = cert0 (contains the human key A and the master key), the LeanIMT update |
| MINT | cm, q, operator |
| TRANSFER | note_root, revoked_root, nf, cm1, cm2. Not published: amounts, owner, lineage, whether it is a split or a delegation |
| EXECUTE | **D** (verifier and ciphertext length), state_root (hence the three roots), now, ctx_hash and the action fields (target, method, params, amount, nonce; amount = q_spent), required cap, tpk, ciphertext (c1, c2, e, esign), note_root, budget_nf, cm_change |
| REVOKE | old_root, new_root, entry (a certificate hash or key entry, unsalted: anyone holding the certificate or key can recognise it, E3 L2/L3), index |
| OPEN | after ≥ t members cooperate: ent[0..D] of that action (the whole chain) |

## 8. Findings while deriving the relations
Class (a): breaks a research-design goal. Class (b): a weakness disclosed, not fixed. Class (c): a modelling choice, documented.

| ID | finding | class | clause |
|---|---|---|---|
| F-1 | **The gate's TPK is immutable** (Gate 77–78). A committee or epoch rotation requires deploying a new gate with a new note tree, and budget cannot move across gates. The epoch tests (E6 O10/O11, E6c) are off-chain only | (b) disclose; party A should state "one committee per gate deployment" | OP-6, EX-C7 |
| F-2 | **holder_sk = 0 is allowed** (EX-8: Num2Bits and < l accept 0), so ent[D] = O is possible if an issuer certifies the identity point as a holder. Anyone can then act as that holder, and the opening shows O at hop D. The issuer ent[D−1] is still revealed. Only an issuer that certifies O is affected | (b) disclose, or a one-constraint fix (ent[D] ≠ O); decision for the user | EX-8, EX-2 |
| F-3 | TRANSFER checks only the owner key and the lineage certificates against revocation, not ancestor keys, expiry or issued membership. A note on such a branch can move but never be spent, because EXECUTE checks everything (EX-3..6). Conservation is unaffected | (c) documented; the BUD game must count unspendable notes as unspent | TR-5, TR-6 |
| F-4 | TRANSFER's delegate edge is the child certificate hash, chosen by the owner without a signature. If no such certificate is issued, the delegated budget is stuck. This is the owner's choice and affects no one else | (c) | TR-7 |
| F-5 | The revocation IMT has a capacity of 2^20 entries (next_index has 20 bits). After that, revocation stops, so availability is lost | (b) disclose | RV-5 |
| F-6 | The operator mints notes with any owner and lineage (MI-1 does not check them). The operator is a trusted issuer of budget (H3 design); a wrong lineage only makes the note unspendable | (c) trust assumption | MI-1 |
| F-7 | `now` is chosen by the prover within clockSkew of block time (EX-C5), so a certificate stays usable up to clockSkew after expiry | (b) disclose (window, like Δ) | EX-6, EX-C5 |
| F-8 | The master key ent[1] and the human key ent[0] are not key-revocable (EX-5). The master is replaced by re-registration (RG-C2) and its old subtree dies after rootWindow. Revoking cert0 (issuer = the human) also works (RV-3, EX-4) | (c) design | EX-5 |
| F-9 | Accountability covers EXECUTE only; TRANSFER and REVOKE publish no ciphertext. Delegation of budget is not attributable by opening; the child's later actions are | (c) scope | — |
| F-10 | The six H_3 uses (C-2, C-4, C-7, C-8, C-9, keystream) share the arity. Separation relies on constant tags or structure. X2a lists every pair; D3 argues the cases without a tag (IMT leaf, state root, keystream) | (c) argued in D3 | C-2..C-9 |
