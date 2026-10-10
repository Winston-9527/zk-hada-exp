# T7 — assumption → theorem → proof → implementation map (for party A; issue #9)
Object: paper.tex §4 (7 assumptions, 6 games G-*, 6 reductions T-*) against the current main circuit **v9** and its gate (main d4e1e3b).

**Rule for the paper: an experiment that passes is never a proof.** The "evidence" column lists finite test sets (mutations, attack rows, real
transactions) that agree with an independent oracle. They show that the implementation matches the *stated relation* on those inputs. They give no
probability bound against an arbitrary adversary. Proof status is in a separate column; "sketch" means a paragraph in paper.tex, which has not been
checked here.

## 1. Assumptions
| paper assumption | used by | v9 still needs it? | remark |
|---|---|---|---|
| A-EDDSA-EUF (Baby Jubjub EdDSA-Poseidon) | T-DEL, T-UNF, T-CAP | yes | — |
| A-POSEIDON-CR | T-ANON, Merkle | yes | v9 also uses Poseidon as a **PRF** (keystream, budget_nf = H(TAG_BNF, sk, cm), key entries). Collision resistance does not give PRF security: **missing assumption** |
| A-GROTH16-KS | all soundness theorems | yes | **requires an honest CRS.** The repository's zkeys use ONE local phase-2 contribution (dev only, `setup_zkeys.sh`). A deployment needs a multi-party ceremony, and the paper should state this as an assumption. Groth16 KS is proven in the generic / algebraic group model |
| A-GROTH16-ZK | T-ANON | yes | ZK also needs a correctly generated CRS (subversion-ZK otherwise) |
| A-MERKLE-BIND | T-REV | yes | v9's revocation uses an **indexed Merkle tree non-membership** proof (low leaf + range) and a LeanIMT for registered roots and notes. Binding of the IMT ordering relation is needed, not only leaf binding |
| A-BABYJUB-ELGAMAL-INDCPA | T-NFF, (T-ANON) | changed | v9 mode C = ElGamal KEM of an ephemeral point K + Poseidon keystream over y-coordinates + a parity word. Security = DDH (for K) **+ PRF of Poseidon(K, j)**, or a hashed-ElGamal argument in the ROM. Missing in the paper |
| A-THRESHOLD-SHAMIR (reconstruct tsk from ≥ t shares) | T-NFF | **replaced** | E6 opens **without reconstructing** tsk: Feldman VSS with a **trusted dealer** + Chaum–Pedersen DLEQ partial decryptions (Fiat–Shamir → ROM) + Lagrange in the group. Needs DLEQ soundness and DL; static corruption of < t members (E6 RESULTS lines 5–8). The paper's assumption and T-NFF text describe the old Shamir-reconstruction design |
| — (not in paper) Semaphore identity / registry | human uniqueness at the root | yes | registration proof (t4_registration) + `ZkDacRegistry` per-domain nullifier: one registered master per human and domain |
| — (not in paper) gate / contract obligations | every game whose "verifier" is the contract | yes | The theorems talk about "the verifier". In v9 several checks are done only by the gate (POLICY rows, E7 `POLICY_CLOSURE.md`): ctx_hash and req_cap computed by the gate, the clock, root windows, the budget nullifier set, AmountMismatch, TPK fixed. The games must define the verifier = Groth16 verify + these checks |

**Concrete security paragraph** (paper.tex after T-NFF): it states ε_KS ≈ 2^-128 for Groth16 over BN254. Published estimates since the exTNFS attacks
put BN254 at roughly 100–110 bits. Baby Jubjub's prime-order subgroup (l ≈ 2^250.6, see HANDOFF pitfalls) gives ≈ 2^125 for generic DL. **The 2^-126
"combined" figure should be recomputed with cited sources** (this review did not do it).

## 2. Games and theorems vs v9
| paper | statement still matches v9? | proof status | mechanized | implementation evidence (NOT proof) | gap |
|---|---|---|---|---|---|
| **G-DEL / T-DEL** | yes in substance (per-hop EdDSA over a hop-indexed cert hash) | sketch | no | T2 single-field mutations D = 1..4 (`../../t2_circuit_fix/zkdac_v9/results/mutations_d*.json`); T3 v9 chain rows A00–A18 (`../../t3_attacks/v9/RESULTS_v9.md`) | reduction loses a factor D_max (stated) |
| **G-UNF / T-UNF** | yes | sketch | no | same as G-DEL | — |
| **G-ANON / T-ANON** | **no**: the game lists public outputs (issued_root, revoked_root, expected_nullifier, action_hash) of the old circuit | sketch for the old circuit | **no** (TANON.lean is constants; LEAN_AUDIT.md) | none for v9 transcripts. E3.4 leakage of revocation entries (L1–L4, `../../t4_revocation/E3-revocation_20261009/RESULTS.md`) | v9 publishes state_root, now, ctx_hash, req_cap, TPK, a D + 6-word ciphertext, note_root, budget_nf, cm_change, q_spent. **D is public** (verifier per D, ciphertext length) and must be in the leakage function. The reduction must add the KEM / PRF hop for the ciphertext and the PRF for budget_nf. Disclosed leaks: unsalted certificate revocation entries (E3 L3), key entries linkable by key holders (L2). Research design E6's linkability test on v9 transcripts is **not done** |
| **G-CAP / T-CAP** | yes; req_cap now comes from the gate | sketch | no | T2; T3 cap rows; A11-req closed by the gate (E7 G5) | game must say req_cap is chosen by the verifier |
| **G-REV / T-REV** | **no**: describes "issued-membership omits a removed parent" (allow-list, old SMT) | sketch for the old design | no | E3 (0 false accept, 14 / 14 ablation, Δ latency); T5 scale (0 false accept, 0 collateral denial, 1,230 agents); T3 revocation rows; E7 authorized, monotonic revocation (forge) | restate as: accepted ⇒ no certificate or delegate key of the chain is in the revocation set of a root at most Δ old. Reduction: IMT non-membership soundness ← Poseidon CR + KS; plus monotonic, issuer-authorized roots (revoke_transition proof, ZkDacRevocations) |
| **G-NFF / T-NFF** | partly: the game is fine; the reduction is not | sketch for the old design | **no** (TNFF.lean does not compile; its axioms are inconsistent) | E6: 65 / 65 rows (opening exact; wrong shares identified by DLEQ; mode C detects a wrong opening, mode A does not); v9 compressed opening 10 / 10 per D (`../../t2_circuit_fix/zkdac_v9/results/opening_check*.json`); T3 A22 rows | **the bound omits Adv_Groth16-KS.** That the ciphertext encrypts the witness keys is a circuit constraint, so it needs knowledge soundness. Replace Shamir reconstruction with DLEQ soundness + trusted dealer |
| **missing: G-BUD** budget conservation (H3) | — | **none** | no | E2 real-tx races (640 vs 100 on v7; capped at 100 on v8); T3 A20 rows; v8 / v9 forge (`../../t2_circuit_fix/zkdac_v8/RESULTS.md`) | needs a game (spent + unspent ≤ minted under any interleaving; research design Q2) and a theorem: note binding (CR) + nullifier uniqueness (PRF / CR) + KS + atomic gate. A good candidate for the Lean state-machine invariant (research design line 160) |
| **missing: G-CTX** action binding / no retargeting | — | none | no | T3 A23 (proof level: every retarget fails), E7 G4 × 7 | needs a game. Groth16 is malleable, but a re-randomized proof keeps the same public inputs; single use comes from the budget nullifier |
| **missing: G-REG** one master per human and domain | — | none | no | t4_registration tests (14 / 14 negatives) | needs a game, or an explicit assumption on the registry |
| **missing: G-REVAUTH** only the issuer / key owner can revoke; no un-revoke | — | none | no | E7 `revoke/` (revoke_transition) + RevokeV7R forge | needs a game (EdDSA-EUF + KS + monotonic contract) |

## 3. Wording for the paper (proposal for party A)
- Keep "the proofs are not mechanized". Remove or relabel `mechanization/` as an unfinished draft: it does not build, and it must not be cited (LEAN_AUDIT.md).
- Present the attacks, mutations and receipts as **"implementation conformance testing against the stated relation"**. Do not write "validates the
  security games" (paper.tex line 341 currently says the correspondence is "validated empirically"). Report the counts as finite tested sets.
- Update G-ANON, G-REV and T-NFF to v9. Add G-BUD and G-CTX (the paper's H3 and context-binding claims have no game today). Add the missing assumptions:
  Poseidon-PRF, an honest CRS, DLEQ / ROM, trusted dealer, and the registry.

## 4. Options (decision for the user / party A; nothing below was started)
1. **Paper-proof route** (recommended): party A or a cryptographer rewrites §4 for v9 per section 2. We can supply the exact v9 relation (R1–R6,
   public-input order, gate checks) as an appendix table.
2. **Small Lean target**: a state-machine model of the gate + note set + revocation roots. Prove budget conservation (G-BUD) and revocation
   monotonicity as invariants, as the research design asks. Feasible in days. It mechanizes the non-cryptographic part only, and says so.
3. **Full game-based mechanization** (EasyCrypt / SSProve): months; not recommended within the current schedule.
