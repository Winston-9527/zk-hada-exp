# T6 — fair baselines (issue #8, research design E5) — pre-registration (committed and pushed BEFORE any measurement)
Base: main 728e64d (v9 main circuit; T5 merged). Research design §1 lines 31–32, §7 E5 (lines 178, 237–249). Machine: Apple M5 Pro (15 cores, 48 GiB).
Everything runs locally. Official code is cloned into `vendor/` (git-ignored), at the commits below. **Only build feasibility was checked before this file**
(compile + the projects' own unit tests); nothing was timed.

## Rules (from the research design)
1. A strong neighbour is **not excluded because it uses another stack** (Rust / Go / Python / Noir, other curves or proof systems). This corrects RQ114,
   whose criterion was "circom source available" (see "RQ114" below).
2. Missing functionality is **N/A**, never zero cost. A self-written toy is never presented as an official system.
3. **Two separate tables**:
   - Table 1: cross-system, official native paths, aligned sub-tasks;
   - Table 2: same stack (circom / Groth16 / BN254 / our contracts), cost of each component and the plaintext lower bound.

   Constraint counts across proof systems are not compared as equal work.
4. Numbers reported by a paper but not run here are labelled **"reported, not measured"**.

## Availability (checked 2026-10-10)
| id | system | official code | status |
|---|---|---|---|
| B1 | UCAN v1.0.0-rc.1 | go-ucan 46ec5c69 (2026-09-12), Go 1.27.2; rs-ucan 59ff9b9c (2026-03-29) | runnable. rs-ucan's `syntatic_checks` does not verify signatures or time bounds, so **go-ucan is the measured path** (signatures checked on decode, time bounds, policy, chain in `ExecutionAllowed`). Revocation is not implemented in either (spec draft only) → N/A |
| B2 | DAC from EQS (Mir, Slamanig, Bauer, Mayrhofer, PETS 2023) | mir-omid/DAC-from-EQS 4ff86a33 (2023-05-08), Python 3.11, petlib 7aafddb4, bplib fork caro3801@129533b7, coconut-lib d45b1426 (the commits pinned in its flake.nix; installed with uv + Homebrew OpenSSL 3 instead of nix) | runnable; its 15 tests pass |
| B3 | zk-creds (Rosenberg et al., S&P 2023) | rozbb/zkcreds-rs 197e46f7 (2022-09-29, archived), rustc 1.98.1 | runnable. The only change: the `linkg16` git dependency URL is ssh → https (same commit a405a850) |
| B4 | ZKM 0.1.0-draft (spec rev 12) | spec links github.com/pyramidal-io/ZKM.dev → **HTTP 404** (not public) | protocol comparison only; no timing |
| B5 | ZK-ACE (arXiv 2603.07974v2) | no code link in the paper | protocol comparison only; its numbers are "reported, not measured" |
| B7 | ZEBRA (Rathee, Policharla, Xie, Cottone, Song, ePrint 2022/1286): SNARK anonymous credentials with auditability, revocation and on-chain verification; layer-1 / layer-2 wallets | no code found (GitHub search and the ePrint page, 2026-10-10) | protocol comparison only; its gas numbers are "reported, not measured". It is a strong neighbour (accountability + revocation + on-chain) and goes into the feature matrix |
| B6 | root-only / enumerate-descendants revocation | same stack, E3 ablation (#34) | cited from E3, no new run |

## Table 1 — cross-system, aligned sub-tasks (fresh instance per sample unless stated; N = 30 per cell; mean ± SD, median, p95)
Workload parameter: chain length **D = 1..4** = the number of delegation certificates from the root authority to the acting holder (ZK-DAC's D).

| | B1 go-ucan | B2 DAC-EQS | B3 zk-creds | ZK-DAC v9 |
|---|---|---|---|---|
| issue / delegate one edge | `delegation.New` + `ToSealed` (Ed25519) | root `issue_cred`, then `delegator` + `delegatee` per level | — (no delegation: N/A) | key + EdDSA cert sign (T5 issuance bench) |
| holder's show / action | invocation `New` + `ToSealed`, argument `amount = 1` | `proof_cred` disclosing one attribute subset per level | official microbench `simple_expiry` (issuance-tree membership + expiry predicate + linkage) | local authorization computation (T5 E4a) |
| verifier | decode + signature check of all D + 1 tokens + `ExecutionAllowed` | `verify_proof` | official verify in the same microbench | off-chain verify (T5) and on-chain gas (T5) |
| size | sealed bytes of D delegations + invocation | serialized proof (petlib/bplib export) | `proof_sizes.csv` of the bench | proof 3 group elements + public inputs |
| policy | each delegation carries the predicate `.amount <= cap_i` (attenuating) + expiry | attribute sets (its native policy) | expiry > threshold | 32-bit cap attenuation + expiry + budget |

- go-ucan and DAC-EQS: our own harness (`bench_ucan/`, `bench_dac.py`) calls **only the official public API**. A fresh chain of keys per sample; D = 1..4.
- zk-creds: the official criterion microbenches run unchanged (`cargo bench -- <name>`): `simple_expiry`, and `tree_forest_tradeoff` if it builds. Criterion
  reuses one witness across iterations, so these are **technical replicates, not N = 30 independent instances**, labelled as such. Its parameters
  (tree height, number of trees) are reported as found in the source.
- Feature matrix (same table), each cell ✓ / ✗ / partial with a one-line source:
  - lineage hidden from the verifier;
  - lineage hidden from the delegatee;
  - delegation depth;
  - per-hop revocation;
  - root-only revocation;
  - budget conservation across siblings;
  - action / context binding and replay protection;
  - accountability opening;
  - on-chain verification;
  - human uniqueness at the root.

  Sources: the official code at the pinned commit (for B1–B3), the spec or paper (B4, B5), our RESULTS (ZK-DAC).

## Table 2 — same stack
1. **B0 plaintext lower bound.** One Solidity gate with the same policy:
   - ECDSA (`ecrecover`) signature chain of D certificates;
   - cap attenuation and expiry per hop;
   - per-hop certificate and key revocation (mappings, issuer-authorized);
   - context hash computed by the gate;
   - an atomic per-edge budget ledger: each certificate carries an allotment; the children of an edge sum to at most its allotment; spending decrements;
     replay is impossible because the ledger is updated in the same tx.

   Measured: forge gas of `execute` at D = 1..4, real signatures, one tx per sample (deterministic, so N = 1 per D, plus revocation and over-spend
   rejection tests). **Privacy cost = v9 − B0** at the same D. For v9, the note-index law of T5 is used:
   `529,576 + 27,089·popcount + 7,763·D` (excludes intrinsic gas; the B0 number is likewise execution only, and both are also given with intrinsic gas
   and calldata).
2. **Component cost, v6 → v7 → v8 → v9 at D = 1..4.**
   - constraints (existing, cited);
   - **new paired proving benchmark**: N = 30 fresh instances per (version, D); version order shuffled within each of 3 process blocks (seed
     `t6-comp-<block>`); mean ± SD, permutation test between consecutive versions, Holm over 3 × 4 comparisons;
   - gas from existing receipts (cited).

   This prices per-hop key revocation (v6), accountability (v7), budget notes (v8) and public-input compression (v9).
3. **B6** root-only vs per-hop revocation, and enumerate-descendants: E3 numbers cited (`../../t4_revocation/E3-revocation_20261009/RESULTS.md`).

## RQ114 (to be written into RESULTS as a negative result about the previous comparison)
RQ114 (V119/V120) excluded zk-creds and ZEBRA because no circom source existed. Its hypothesis "A-BASELINE-SOURCE-AVAILABLE" was falsified only under
that circom-only criterion, and research design line 31 rejects that criterion. T6 records the RQ114 outcome verbatim and states what changed: zk-creds is
run natively here. ZEBRA still has no public code (re-checked 2026-10-10: GitHub search, ePrint page); it is compared at protocol level (B7).

## Failure handling
A baseline that fails to build or run during T6 is reported as "not executable" with its log, never dropped. Time-outs: 30 min per baseline cell.
