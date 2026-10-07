# T1 findings (2026-10-06): which circuit produced which paper number

Environment: circom 2.2.3 (macOS arm64), circomlib 2.0.5 (tarball sha1 183c703e… matches npm registry).
Source: ttwang-szu/ZK-HADA @ 7966d60. Builds here are from-source recompiles; no proving keys, no proofs yet.

| Circuit (source) | source sha256 | constraints (recomputed) | public inputs | recorded/claimed |
|---|---|---|---|---|
| RQ108 @ f494963 (2026-06-07) | d8bfc95467dc… | **46,585** (36,251 non-linear + 10,334 linear) | 4 | = runs/RQ108 compile_metrics.json (46,585, same circuit_sha256) |
| RQ108 @ 7966d60 (HEAD, after 6/15 commit 11b988b) | 517ebb8036… (LF) | **46,593** (36,275 + 10,318) | 4 | = the paper's "46,593 C5" |
| RQ112 @ 7966d60 | see build output | **49,344** (40,841 + 8,503) | 6 (gov_Ax, gov_Ay, …) | accountability circuit; not 4 public inputs |

r1cs sha256: f494963 = a26c62ffde3657e41b1c77f583e0f6261400e06fb61796acbe6de8a174857d39; RQ108-HEAD = f4efb4b38291e0ff02aba952d9bda11ab7018c36deb2671a69401daaecb2b37f; RQ112 = 17ff9b528f87d0093bdeea62f657d7501cf5c96c6b629d671f234c97f734a483

## Conclusions (verified by recompilation / diff)
1. The 6/07 measured circuit (46,585) is exactly recoverable: file hash equals the recorded circuit_sha256 and the count reproduces.
2. The paper's 46,593 is the HEAD RQ108 circuit, which contains NO ElGamal / accountability logic (grep: 0 matches; only 4 public inputs). The paper's claim that C5 = 46,593 includes a 23,080-constraint ElGamal part is not supported by this circuit.
3. Commit 11b988b ("circom 2.2.3 compatibility") also added witness-controlled eddsa_enabled_i / merkle_enabled_i / rev_enabled_i inputs. In f494963 these were hard-wired (enabled <== 1; unconditional root equality). So the soundness hole (prover sets flag 0) exists in HEAD, not in the 6/07 measured circuit. This corrects an earlier statement that it affected the measured circuit.
4. The circuit file is generated (write_circuit.py), hence the "{{ }}" in the template; circom accepts it.
5. RQ112 (accountability) has 6 public inputs and a different statement; it is not the 4-input circuit the paper describes.
6. Paper's constraint-breakdown table (sums to 66,593) and the 46,593 total are unrelated to any compiled artifact so far.

## Not yet established
- Which circuit RQ116's 73,534-constraint benchmark used (source not found locally).
- Origin of 1.51 s prove time and 235,891 gas.
- Whether 23,080 / 2,981 / 1,000 / 6,000 component numbers were measured at all.
