# T6 — fair baselines (issue #8, research design E5) — results
Pre-registration: `PREREGISTRATION.md` (fb8dd96, before any measurement).
- Harnesses: 9058152; zk-creds vendor changes recorded in `zkcreds_patch/`.
- Run `./run_t6.sh`, 2026-10-10 10:54–11:14 UTC; every step exit 0 (`results/logs/steps.txt`).
- Statistics: `node analyze_t6.mjs > results/analysis.json`. Every number below is from that file unless another file is named.
- Machine: Apple M5 Pro, 15 cores.

## Verdict
1. **The baselines run natively; nothing is excluded because of its stack.**
   - Measured: three official implementations (go-ucan, DAC-from-EQS, zk-creds).
   - Compared at protocol level: the three without public code (ZKM, ZK-ACE, ZEBRA).
2. **No compared system offers the full combination: per-hop revocation + compulsory (threshold) accountability + sibling budget conservation, with
   hidden lineage and on-chain verification.**
   - The closest is **ZKM**: hidden lineage, in-circuit conservation, context-bound nullifiers, on-chain verifiers. But its revocation is root-level
     only (a revocation kills the whole subtree; per-hop is deferred to its artifact-v2), and its disclosure is voluntary only (the spec explicitly
     rules out compulsory opening).
   - This supports H3's positioning as the *combination*. It also **contradicts two sentences of the current paper.tex** (see "Paper alignment").
3. **Cost of privacy (same stack, same policy).** v9 costs 2.4–4.7× the gas of the plaintext lower bound B0 on a fresh note tree, and 3.3–6.0× at T5's
   world size (2.6k–3.8k notes).
   - In absolute terms: +332k (D = 4) to +422k (D = 1) gas on a fresh note tree; +515k to +571k at T5's world size.
   - It costs ≈ 0.9–2.7 s of local proving where the official non-private / non-SNARK systems need ≈ 0.02–16 ms.
4. **Component costs** (v6 → v7 → v8 → v9, paired, N = 30 per cell):
   - accountability (v7) adds +65 to +84 ms of proving (D = 3: +620 ms, explained below);
   - budget notes (v8) add +63 to +87 ms;
   - public-input compression (v9) costs nothing measurable in proving: −1.5 to −7 ms, all Holm p ≥ 0.21.

## Table 1 — cross-system, official native paths (mean ± SD, N = 30 fresh instances per cell unless stated)
| D | **B1 go-ucan** issue / edge · invoke · **verify** · bytes | **B2 DAC-EQS** issue · show · **verify** · bytes | **B3 zk-creds** (expiry show) | **ZK-DAC v9** (T5) local · verify · gas |
|---|---|---|---|---|
| 1 | 0.033 · 0.034 · **0.156 ± 0.156** ms (one outlier) · 685 B | 11.5 · 2.74 · **16.2 ± 0.2** ms · 586 B | prove 299 ms (tree 244 + forest 17 + expiry 32 + link 5.5) or monolithic 260 ms; verify 3.3 ms (link) / 0.68 ms (monolithic); 1,064 B | 916 ms · 4.9 ms · 686k* |
| 2 | 0.025 · 0.027 · **0.158 ± 0.059** ms · 1,075 B | delegate 3.46 · show **N/A** · verify cred 9.9 ms · 359 B | N/A (no delegation) | 1,554 ms · 4.8 ms · 706k* |
| 3 | 0.020 · 0.023 · **0.166 ± 0.012** ms · 1,464 B | **N/A** (official code: one delegation level) | N/A | 2,415 ms · 4.7 ms · 727k* |
| 4 | 0.018 · 0.020 · **0.184 ± 0.009** ms (p95 0.200) · 1,853 B | **N/A** | N/A | 2,740 ms · 5.2 ms · 743k* |

\* Mean execute receipt in the T5 world. The cost depends on the note-tree size: 537k–561k on a fresh tree (T5 law).

- **B1 go-ucan** (46ec5c69): 30 / 30 valid invocations accepted; 30 / 30 over-cap invocations (`amount` above every `.amount <= cap` predicate)
  rejected, at every D.
  - Verify = decoding every token (Ed25519 signature check) + `ExecutionAllowed` (chain, time bounds, policy).
  - Revocation is not implemented in go-ucan or rs-ucan (UCAN revocation is a separate draft spec).
  - Nonce reuse is "out of scope for go-ucan" (its `proof.go`, rule 5b).
  - The lineage is in clear: every DID of the chain is in the tokens.
- **B2 DAC-from-EQS** (4ff86a33):
  - D = 1: issue, show and verify; 30 / 30 accepted, and 30 / 30 shows against a subset not in the credential rejected.
  - D = 2: `delegator` + `delegatee` and verification of the delegated credential (as its own `test_issuing` does), 30 / 30.
  - **Not available in the official code:**
    - showing a delegated credential: `delegatee` does not return the randomizer that `proof_cred` needs;
    - D ≥ 3: the delegated credential carries no update key.

    The paper's scheme is multi-level; only the code is limited.
  - Show proofs are not bound to an action; there is no revocation and no on-chain verifier.
  - The workload uses 2 attribute sets per root credential, as in its tests: with 1 set its `verify_cross` fails (smoke run).
- **B3 zk-creds** (197e46f7):
  - What it measures: the official `simple_expiry` microbench, unchanged. Issuance list of 2^31 leaves as 256 trees of height 24; credential
    expiry > threshold; linkage. Arkworks Groth16 on BLS12-381, multithreaded.
  - **Criterion repeats ONE witness: technical replicates, not N = 30 instances.**
  - Not supported: delegation, budget, accountability, action binding (the expiry show proves only expiry and list membership).
  - Only the aligned sub-task (one credential: membership + expiry predicate) is comparable with a part of ZK-DAC's D = 1 relation. ZK-DAC's D = 1
    additionally carries per-hop certificate and key revocation, the registered-root path, accountability encryption and the budget note.
  - So **these numbers do not mean that ZK-DAC is 3× slower for the same work.**

## Feature matrix (✓ / ✗ / partial; source in the last column)
| system | lineage hidden from verifier | delegation depth | per-hop revocation | root / subtree revocation | sibling budget conservation | action binding + replay | compulsory accountability opening | on-chain verify | human uniqueness | source |
|---|---|---|---|---|---|---|---|---|---|---|
| UCAN (go-ucan) | ✗ (DIDs in clear) | unbounded | ✗ in code (draft spec) | ✗ in code | ✗ | partial (args bound; nonce reuse out of scope) | n/a (lineage public) | ✗ | ✗ | go-ucan @46ec5c69 `token/invocation/proof.go` |
| DAC-from-EQS | ✓ (randomized credential) | paper: multi-level; code: 1 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | code @4ff86a33 `core/dac.py`; PETS 2023 |
| zk-creds | ✓ | none | ✗ | not verified here | ✗ | ✗ in the measured show | ✗ | partial (Groth16; no EVM verifier in repo) | ✗ (issuer-agnostic) | code @197e46f7; S&P 2023 |
| ZKM 0.1.0-draft | ✓ ("no public value correlates them", §4.6) | ≤ 16 default (u8) | **✗ (deferred to artifact-v2, §7.1)** | **✓ (subtree, §7.1)** | **✓ (in-circuit, §4.3)** | ✓ (settlement_context in the nullifier) | **✗ (voluntary only; compulsory opening ruled out)** | ✓ (Solidity / UltraHonk) | ✗ (optional ZKC binding) | zkm.dev/spec (code repo 404) |
| ZK-ACE (2603.07974) | identity hidden | **none (no delegation)** | ✗ | ✗ | ✗ | ✓ (tx hash, nonce / nullifier) | ✗ | not reported | ✗ | arXiv v2 HTML |
| ZEBRA (ePrint 2022/1286) | ✓ (unlinkability) | none described | revocation ✓ (type not verified) | — | ✗ | not verified | auditability ✓ (mechanism not verified) | ✓ (zkSNARK on EVM) | ✗ | ePrint abstract only (PDF behind a bot check) |
| **ZK-DAC v9** | ✓ | 4 (bounded) | ✓ (E3) | ✓ (registry) | ✓ (E2) | ✓ (T3 A23) | ✓ threshold 3-of-5 (E6) | ✓ | ✓ (Semaphore per human) | this repo |

- Not hidden from the delegatee in ZK-DAC: the holder holds its plaintext chain (research design §1). For DAC-EQS, hiding from the delegatee is the
  scheme's goal. For ZKM it is partial: the delegate knows its position.
- Reported, not measured (different workloads; not comparable with Table 1):
  - **ZK-ACE.** The arXiv abstract page gives 2,155 R1CS constraints, 37.3 ms proving, 128-byte proofs (Groth16 / BN254). The v2 HTML gives 4,024
    constraints and ≈ 63 ms, single-threaded. The two versions differ.
  - **ZKM.** ≈ 1.5k ACIR opcodes for spend-conjoined; no timings.
  - **ZEBRA.** 14.3× less gas than Coconut; ≈ 12 USD per verification on Ethereum (May 2023).

## Table 2 — same stack
**B0 plaintext lower bound** (`../../t4_contracts/foundry/src/PlainChainGate.sol`, anvil receipts; 10 fresh chains per D)
- What B0 implements: an ECDSA certificate chain with the same policy, i.e.
  - cap attenuation and expiry;
  - per-hop certificate and key revocation;
  - gate-computed context hash with the holder's signature and a replay set;
  - an atomic per-edge budget ledger.

| D | B0 first execute (median) | B0 second execute | v9 fresh tree (T5 law, popcount 0) | v9 in the T5 world (mean) | v9 / B0 | v9 − B0 |
|---|---|---|---|---|---|---|
| 1 | 115,215 | 98,115 | 537,339 | 686,291 | 4.66 / 5.96 | +422k / +571k |
| 2 | 153,062 | 118,856 | 545,102 | 705,890 | 3.56 / 4.61 | +392k / +553k |
| 3 | 190,883 | 139,577 | 552,865 | 726,837 | 2.90 / 3.81 | +362k / +536k |
| 4 | 228,705 | 160,317 | 560,628 | 743,211 | 2.45 / 3.25 | +332k / +515k |

- B0 grows ≈ +37.8k gas per hop (OLS 37,829: one ecrecover and one fresh ledger slot); v9 grows only +7.8k per hop. **The privacy cost shrinks
  with D.** Linear extrapolation (computed, not measured): the two would meet at D ≈ 15 on a fresh tree.
- B0 semantics checks, at D = 2 and D = 4, all as expected: over budget → `OverBudget`, bad holder signature → `BadSig`, replay → `Replay`, last
  certificate revoked by its issuer → `Revoked`, holder key revoked → `Revoked`.
- B0's first D = 1 sample (152k) includes the first-ever write to the target's storage; the median is used.

**Component costs** (`results/comp_bench.jsonl`)
- Proving time, mean ± SD (ms), N = 30 fresh instances per cell, 3 shuffled blocks:

  | D | v6 (chain + per-hop cert / key revocation + registry) | v7 (+ accountability, mode C) | v8 (+ budget note) | v9 (compressed public inputs) |
  |---|---|---|---|---|
  | 1 | 584 ± 4 | 649 ± 4 | 735 ± 6 | 733 ± 8 |
  | 2 | 1,171 ± 9 | 1,245 ± 12 | 1,330 ± 14 | 1,323 ± 13 |
  | 3 | 1,457 ± 25 | **2,078 ± 22** | 2,165 ± 22 | 2,159 ± 32 |
  | 4 | 2,285 ± 32 | 2,368 ± 40 | 2,431 ± 20 | 2,426 ± 26 |

- Constraints, D = 1..4:
  - v6: 38,266 / 81,944 / 125,622 / 169,300;
  - v7: 47,058 / 91,948 / 136,838 / 181,728;
  - v8: 60,708 / 105,598 / 150,488 / 195,378;
  - v9: 60,622 / 105,424 / 150,226 / 195,028.
- Public inputs at D = 4: 7 / 23 / 27 / 20.
- Consecutive versions, permutation test, Holm over 12 comparisons:
  - v6 → v7 and v7 → v8 are significant at every D (p_holm = 0.0012);
  - v8 → v9 is not significant at any D (p_holm ≥ 0.21).
- **D = 3 jump (+620 ms, ×1.43).** v6 at D = 3 (125,622 constraints) fits the 2^17 FFT domain; v7 (136,838) needs 2^18. The accountability block itself
  costs ≈ 9k constraints. The handoff noted this (v7 C D = 3 exceeds 2^17 by 5,766 constraints).
  - **An optimisation that brings D = 3 back under 2^17 would save ≈ 0.6 s at D = 3.** This is not done; it is listed as optional in the handoff.
- **B6** (root-only vs per-hop revocation, enumerate-descendants): see E3, `../../t4_revocation/E3-revocation_20261009/RESULTS.md`.
  - Without per-hop checks, descendants are falsely accepted 14 / 14.
  - Enumerating descendants needs k + 1 inserts and reveals the subtree size.
  - Root-only revocation has constant cost but kills every other chain of the same human.
  - Per-hop revocation needs 1 entry.

## RQ114 (recorded as the previous comparison's negative result)
RQ114 (V119 / V120, `docs/research/V120/rqs/RQ114_SOTA_BASELINE_COMPARISON/closeout.md` in the main repo) declared its hypothesis
"A-BASELINE-SOURCE-AVAILABLE" falsified: zk-creds is Rust / bellman, not circom, and ZEBRA has no code. It therefore made no quantitative comparison.
- The falsification is correct only under its circom-only criterion. Research design line 31 rejects that criterion, and T6 shows the baseline *is*
  runnable natively: zk-creds above, with only a dependency-URL change.
- The ZEBRA part stands: there is still no public code (re-checked 2026-10-10).
- RQ114's qualitative feature matrix was built from paper descriptions. Two of its entries are contradicted here:
  - ZK-ACE has no delegation;
  - ZKM, which RQ114 did not include, has subtree revocation and on-chain verification.

## Paper alignment (to #11; not edited here)
1. "Cascade revocation … is absent from all prior systems" (paper.tex key observation 2): **false** — ZKM revokes whole subtrees (§7.1). The defensible
   claim is per-hop revocation of an internal edge without touching siblings, together with hidden lineage. ZKM defers exactly this.
2. "No existing system provides both transitive delegation and SNARK-native on-chain verification" (observation 1): **false** — ZKM (delegation ≤ 16,
   UltraHonk Solidity verifiers).
3. Table row ZK-ACE "Deleg. Depth 1": **should be "none"**. Its numbers differ between arXiv versions; cite the version.
4. ZKM and ZEBRA are missing from the comparison table. RQ114's "no circom code" is not a valid exclusion reason.

## Deviations (transparent)
1. **zk-creds needed two vendor changes**, both recorded in `zkcreds_patch/`:
   - the `linkg16` git dependency URL changed from ssh to https (same commit);
   - an added bench target that runs only the upstream microbench group, because the default target panics without a US passport dump.

   No upstream benchmark code was changed.
2. **DAC-EQS** was installed with uv + Homebrew OpenSSL 3 at the commits pinned in its flake.nix, instead of nix.
   - `termcolor` and `numpy` were also installed: its tests import them but the flake's list was not read.
   - Workload: 2 attribute sets (see above).
3. **go-ucan** needed the algorithm registration imports that its own tests use (`crypto/all`, `verifiers/did-key`).
4. **Protocol-level sources.**
   - ZEBRA's full text could not be read: the ePrint PDF is behind a bot check, which was not bypassed. Its row uses the abstract only, and
     "not verified" marks what the abstract does not state.
   - ZK-ACE and ZKM: read from the arXiv HTML and zkm.dev.
5. **Go 1.27.2** was installed with Homebrew for go-ucan.

## Limits
- One machine. The official systems use different curves and proof systems (Ed25519; BN254 pairings in Python; BLS12-381 Groth16), so Table 1 compares
  end-to-end costs of aligned sub-tasks, not equal work.
- zk-creds numbers are technical replicates of one witness.
- B0 is our own implementation, not an official system. It is labelled as the same-stack plaintext lower bound.

## Corrections 2026-10-12 (audit #58; appended, text above unchanged)
Re-analysis without new measurements: `../T6b-reanalysis_20261012/` (pre-registered post hoc).
- **B0 is a plaintext reference gate, not a proven lower bound.** It is self-written, with one cold SSTORE per hop (+37.8k per hop).
- **The privacy-cost ratio depends on accounting.** Over {B0 first / second execution} × {with / without 21k intrinsic} × {law at popcount 0 /
  measured receipt}:
  - fresh tree **2.45 – 6.70**;
  - T5 world size **3.25 – 8.63**.

  The numbers above (2.45 – 4.66 / 3.25 – 5.96) are the lower end: B0's cold first execution, with intrinsic gas. "Shrinks with D and crosses near
  D ≈ 15" is a property of B0's design and is dropped as a general claim.
- **Deviation not listed before.** The pre-registration said "excludes intrinsic gas"; the analysis used receipt gasUsed (which includes it) on both
  sides.
- **"Fresh tree" v9 (560,628 at D = 4) is the law extrapolated to popcount 0.** The measured near-empty receipt is 564,147, ratio 2.47 instead of
  2.45.
- **The component test was unpaired, although it was pre-registered as paired.** The paired sign-flip test (by instance seed) gives the same
  decisions, except v8 → v9 at D = 2: −7.0 ms, p_holm = 0.031. "v9 compression has no significant effect" becomes "at most −7 ms (D = 2,
  significant); not significant at D = 1, 3, 4".
- `analysis.json` rounds the B0 medians (115,200); the exact values are 115,215 / 153,062 / 190,883 / 228,705 (`b0_anvil.json`).
