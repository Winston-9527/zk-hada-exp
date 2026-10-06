# Paper (paper.tex @ e44847d) vs. repository evidence — claim-by-claim map

Basis tags: **[recompiled]** rebuilt here with circom 2.2.3; **[source]** read circuit/script source; **[artifact]** read a recorded JSON/MD; **[none]** searched, nothing found.
Historical repo: ttwang-szu/ZK-HADA @ 7966d60. Nothing here re-runs proofs; no proving keys exist yet.

## 1. The three circuits (A / B / C)

| | A: RQ108 @ f494963 (06-07) | B: RQ108 @ HEAD (after 06-15 11b988b) | C: RQ112 @ HEAD |
|---|---|---|---|
| Constraints | 46,585 [recompiled] = recorded | 46,593 [recompiled] = paper's "C5"; also V138 benchmark json | 49,344 [recompiled] = V138 json |
| Public inputs | issued_root, revoked_root, expected_nullifier, action_hash | same 4 | gov_Ax, gov_Ay, ct0_c1x, ct0_c1y, ct0_c2x, ct0_c2y (6); the four above are **not** public |
| Diff vs A | – | only adds witness-controlled `eddsa_enabled_i`, `merkle_enabled_i`, `rev_enabled_i` (12 free inputs). Prover can set 0 and skip that check. | different, rewritten circuit; not a superset of A/B |
| Proof of possession / anchor | none (signer0 is unconstrained; last holder never signs the action) | same | same |
| Revocation | membership of Poseidon(cert_hash,0) in the "revoked" tree (an allow-list, not non-membership) | same (and skippable) | `Poseidon(Poseidon(leaf,0),0)===root` with constants 0: degenerate |
| Accountability (ElGamal) | none | none | slot 0 of 5 only; file says "SLOTS 1-4 OMITTED FOR BREVITY IN THIS DIAGNOSTIC" |
| Status | only circuit with hash+count+records matching | has the soundness hole | scaffold / diagnostic |
| Not any of them | RQ116 "C4" 73,534 constraints: source not in archive (`zKDAC_EndToEnd` missing) |

Common to A/B: Merkle depth 2 and the issued tree in the tests contains only the 4 certs of that one chain; expiry is hashed but never compared to a time; cert hash = Poseidon(child pk, cap, expiry) has no parent id/depth/domain; nullifier = Poseidon(free secret, constant); action_hash is a 32-bit mask checked ⊆ terminal cap (no binding to chain/contract/method/params); R2 (master commitment / human credential) does not exist in any circuit.

## 2. Paper claims

| # | Paper says | What the repo shows | Verdict |
|---|---|---|---|
| 1 | Single proof, 4 public inputs, six relations R1–R6 | A/B: 4 inputs but only chain linkage+EdDSA, issued membership, "revoked-tree" membership, cap attenuation, nullifier. No R2. R1 = free-secret nullifier. No R6. C has R6 slot 0 only and 6 different inputs [source] | not supported as written |
| 2 | 46,593 constraints, C5 includes 23,080 ElGamal | 46,593 = B, which contains no ElGamal (grep 0) [recompiled] | number real, description wrong |
| 3 | Breakdown 1,188+32,344+2,981+1,000+23,080+6,000 | sums to 66,593; 4×EdDSA (32,344) > C4 total (23,513); no artifact for the components [none] | internally inconsistent |
| 4 | C0=1,188, C4=23,513 | "bypass"/"minimal" circuits not in archive [none] | unsupported |
| 5 | Proof 805 B constant | RQ116 sizes 801–807: it is the snarkjs proof.json text size, varies [artifact] | mislabelled |
| 6 | Prove 1.51 s ± 0.53, N=10 | RQ108: one run 1.58 s [artifact]; RQ116 (73,534): 1.097 ± 0.009 s, witness generated once [artifact]; 1.51±0.53 not found | unsupported |
| 7 | Verify 0.55 s ± 0.36 | RQ116: 0.41 s [artifact] | unsupported |
| 8 | Gas 235,891 (geth dev, N=10) | only in paper.tex. RQ108 gas_metrics.json: 215,598, round timestamp, no tx hash/log [artifact]. V146 registry **blocks** "production EVM gas" | unsupported |
| 9 | 32/32 forgery rejected | exists for A on a depth-2 base witness: 32 single-field mutations [source]. 3 "cap" mutations are not re-signed so they fail at EdDSA, not at attenuation; "chain_break" duplicates signer1_Ax. Never run on B; never tests enable=0 | real for A, weak |
| 10 | 4/4 capability overreach | 4 regenerated, correctly signed cases [source]; valid for A attenuation + action⊆cap | OK for A |
| 11 | Cascade revocation validated (1/1) | test replaces parent leaf, keeps stale paths, new root [source]; "independent branch" is a separately generated chain/tree. It does not isolate cascade from a plain root change. RQ113: depth 2–32 compile only, `witness_verified:false` | weak |
| 12 | Threshold accountability t=3/n=5, 9 ciphertexts, 4/4, 0 leaks | RQ110: offline JS script on A's input; `dmax4_circuit_integrated:false`; 9 ciphertexts unexplained; "tampered rejected" = decrypted point ≠ original (ElGamal is malleable; nothing detects it); "0 leaks" = string search, not IND-CPA; secret derived from hash of the input file; no proof of correct partial decryption [source] | demo only |
| 13 | R1 enforced via nullifier | free-secret nullifier; paper's own L1 admits no personhood circuit | not R1 |
| 14 | MMD scaling table n=5..100 | numbers not found in archive; old MMD-era story; paper calls it non-core | unsupported / remove? |
| 15 | Six games + six theorems | C2 doc is 89 lines, bound to circuit A (no R1/R2/R6); "reduction ledger" only checks listed paths exist [artifact] | paper proofs; not verified |
| 16 | "Not mechanized" (paper) | Lean exists but TANON uses constants 3/4,3/4,1/2; TNFF uses PMF.pure, axioms, 2 sorry [source] | paper text OK; Lean must not be cited as proof |
| 17 | Table 1/2 vs ZK-ACE (2,155), UC-DAC, TDAC… | literature claims; RQ114 baseline comparison = honest negative (sources unavailable) [artifact] | unverified |
| 18 | "First SNARK-native…" | V146 registry BLOCK_PRIORITY_OR_SOTA; RQ114 boundary also forbids it | contradicts team's own registry |
| 19 | HW: i9-13900K, Ubuntu 22.04, N=10 | experiments ran on /home/xyh (Linux) and ssh 201; CPU not recorded [none] | unsupported |
| 20 | Data availability: 9/9 adversarial, dmax4_minimal 3,492 | contradicts abstract (32/32) and conclusion (37/37) | inconsistent |

## 3. What V146's registry (the team's own frozen claims) allows/blocks
Allowed (bounded): Dmax=4 lifecycle; C4 = 73,534 constraints "paper-facing full E2E"; RQ136 depths 2/4/8/20 (artifacts missing locally); RQ137 C6 depth32 sub-benchmark (missing).
Blocked: production EVM gas; "SNARK enforces threshold accountability"; unqualified C4; full C1–C6 integrated benchmark; first/SOTA; submission-ready.
The 06-20 paper rewrite (e44847d) postdates V146 (06-16) and contradicts several blocked claims.

## 4. Where D_max = 4 comes from, and what "depth 4" means in the circuit
- Origin: a design decision in PIVOT_ZK_DAC.md (2026-06-05/06), section 2.1 ("hard bound, enforced by fixed-size Groth16 circuit with padding"), with an illustrative Human→Master→Sub→SubSub→SubSubSub tree. The only quantitative justification recorded is feasibility: 4 × EdDSA-Poseidon (8,086 each, RQ105) fits Groth16, unlike pairing/ECDSA signatures. No workload or threat analysis selects 4 over 3 or 5. The paper's Sybil-amplification argument justifies *a* bound, not this value.
- Circuit meaning (A/B, [source] generate_chain): 4 fixed certificate slots. Real chain entity0→entity1→entity2→entity3, and the last real entity self-signs the terminal cert. So depth 4 = 4 keys / 3 delegation edges + 1 self-cert, not "Human + 4 levels" as in the PIVOT diagram.
- Shorter chains are padded with prover-generated keys that self-sign zero-capability certs; nothing in the circuit marks or constrains padding. Consequence: with zero terminal capability, a depth-2/3 chain can only prove action_hash = 0. The 6 "valid" witnesses at depth 2/3 and the 32 forgery mutations (base = depth-2 chain) therefore exercise an empty action.
- There is no depth field in the cert hash, so "depth enforced in-circuit" only means "at most 4 slots exist".
