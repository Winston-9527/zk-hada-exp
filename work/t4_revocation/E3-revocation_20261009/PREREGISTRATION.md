# E3 revocation of hidden delegation branches (H2) — pre-registration (committed BEFORE any run)
Issues #6 (T4), #18 (window Δ). Branch `t4-e3-revocation` from main 2eeac99 (v7 merged; main circuit = v7 mode C, user decision 2026-10-09).
H2 (research design line 58): revoking one hidden delegation branch blocks its descendants and keeps sibling branches, without enumerating descendants.
Stop condition (research design line 321): if per-hop revocation needs the full lineage published or every independent branch re-signed, H2 fails.

## Mechanism under test (already in v6/v7, not changed here)
Every hop i = 0..D−1 proves cert[i] ∉ revocation IMT (indexed Merkle tree, depth 20); every delegate key ent[2..D] proves H("zkrk", Ax, Ay) ∉ IMT;
cert[i] = Poseidon(i, issuer key, holder key, cap, expiry); hop 0 ∈ registered-root tree, hops ≥ 1 ∈ issued tree (depth 16). The gate accepts the current
revoked root or a retired one for `revokedWindow` = Δ seconds after it was retired.

## World W (E3.1)
Human H (ent0) → master M (ent1) → 4 subs (depth 2) → 3 each (depth 3, 12) → 2 each (depth 4, 24): 41 holders of H, each acting with circuit D = its depth
(M with D = 1). A second human H' → M' → 2 subs: 3 holders. Node X (depth 3) holds two certificates for the same key, one from S1 and one from S4 (2 chains).
20 random decoy entries pre-inserted in the IMT. Shared issued tree, shared revocation IMT and shared registered-root tree (both root certs registered).
Caps 0xFF/0x3F/0x0F/0x03 and expiry 5000/4000/3000/2000 by depth; now = 1000. Witness-level checks (v7 mode C wasm; T2 established witness level =
proof level for these fields). "Refresh" = recompute all revocation witnesses against the new IMT.

| ID | Revocation (one IMT insert unless stated) | Expected |
|---|---|---|
| R0 | none | all 46 holder-chains accept |
| R1 | root edge cert(H→M) | all 41 of H reject (no non-membership witness exists); H' 3 accept |
| R2 | middle edge cert(M→S2) | S2's subtree (10) reject; all others accept after refresh |
| R3 | deep edge cert(S2→S21) | S21 + 2 children reject; others accept |
| R4 | leaf edge cert(S21→S211) | 1 reject; others accept |
| R5 | key entry of S3 (position 2) | S3's subtree (10) reject; others accept |
| R6 | unrelated random entry | all accept after refresh |
| R7a | cert(S1→X) | X via S1 rejects; X via S4 accepts (certificate granularity) |
| R7b | key entry of X | both X chains reject (key granularity) |
Adversarial witnesses for every rejected holder in R2–R5 (expected: reject unless stated):
- A1 stale (pre-revocation) witness with the new revoked_root → reject.
- A2 stale witness with the OLD revoked_root → **accept at circuit level (POLICY)**: blocked only by the gate after Δ (E3.5).
- A3 every leaf currently in the IMT tried as the low leaf of the revoked entry (with its correct path) → all reject.
- A4 "rotation": the revoked holder signs a fresh certificate to a new key Z and Z acts through the revoked edge (cert placed in the issued tree) → reject.
- A5 "re-issuance": an unrevoked sibling (S1) issues a new certificate to the revoked holder's key → **accept (POLICY: a new explicit authorization by
  an unrevoked delegator, by design; for R5 the key is revoked so → reject)**.
- A6 "skip the revoked hop": chain H→M→S21 reusing M's signature from cert(M→S2) → reject.
**Ablation L (causal role of the per-hop check)**: a copy of the v7 chain circuit that checks revocation only for the LAST certificate and the LAST key
(ablation/; diff recorded). Rerun R2, R3, R5 on depth-4 holders: expected the target descendants **accept** (false accepts) unless their own last
certificate / key is revoked; blocking them under L needs one insert per descendant (enumeration).

## E3.2 update cost vs descendant count
Synthetic subtrees with k descendants, k ∈ {1, 10, 100, 1000, 10000}, IMT pre-filled with 1000 entries. Strategies: per-hop (ours: 1 insert); enumerate
(leaf-only circuit: k inserts, operator must know the descendant set); root-only (1 insert at the root edge; collateral = all non-target chains of the
human). Report inserts, Poseidon hashes, wall time, entries published, collateral chains. On-chain: `updateRoots` gas (one tx for every strategy).
Expected: per-hop constant in k; enumerate linear in k; root-only collateral > 0.

## E3.3 witness maintenance for other holders
IMT pre-filled with R ∈ {1000, 10000} entries; N ∈ {32, 128, 1024} holders × 7 entries (D = 4: 4 certs + 3 keys; random field elements stand in for the
Poseidon outputs). After b ∈ {1, 10, 100} inserts: fraction of witnesses invalid under the new root (expected 100 %), fraction whose low leaf changed,
distribution of changed path siblings per witness, refresh time per holder, and bytes. **Broadcast update**: the operator publishes only the changed
leaves with their final paths; each holder updates its own witness locally (no query revealing what it holds). Expected: equals full recomputation for every
witness. Issued tree (depth 16): same metrics after b issuances.

## E3.4 observation leakage of revocation entries
| ID | Observer / question | Expected |
|---|---|---|
| L1 | public observer: exact search of every revocation entry among all public signals of W's actions (and their 252-bit truncations) | 0 matches |
| L2 | auditor after opening a set of actions (knows ent[0..D]): match key entries H("zkrk", A) | revoked keys of opened chains are linkable (leak, by design of key entries) |
| L3 | anyone who knows both keys of an edge: brute force of the certificate entry over cap × expiry | report Poseidon(7) rate and search-space cost for stated priors (cert entries carry no salt) |
| L4 | entries published per revocation | per-hop: 1 (subtree size hidden); enumerate: k (subtree size leaked) |
| L5 | witness fetch | query-by-key leaks the holder's entries to the server; report broadcast-update and full-download sizes |
Not measured: timing correlation (actions stopping after a revocation), network-level metadata.

## E3.5 window Δ and revocation latency
Forge, ZkDacGateV7 (mode C D = 4 fixture), Δ ∈ {0, 12, 60, 240, 3600} s: after `updateRoots` at t0, a proof against the retired root is accepted at
t0 + Δ and rejected (StaleRevokedRoot) at t0 + Δ + 1. Gas of `updateRoots`. Monte Carlo (10^5 honest actions per cell): proof built on the root current at
start, prove time from the v7 bench (D = 4, 2.45 s), inclusion delay U(0, 12) s + 12 s; revocation updates Poisson with rate λ ∈ {1/3600, 1/60, 1/12} s⁻¹;
Δ ∈ {0, 12, 60, 240} s. Metric: fraction of honest actions rejected as stale (retry rate) vs the revoked holder's exposure Δ. Expected: rejection → 0 once
Δ ≥ prove + inclusion time; exposure grows linearly with Δ.

## Pass criterion
No FALSE_ACCEPT outside POLICY rows (A2, A5) and the ablation (whose false accepts are the expected result). Every sibling / unrelated holder accepts after
refresh (no collateral denial). Deviations go to RESULTS.md "deviations from pre-registration"; raw outputs are never reclassified.

## What this can and cannot support
Supports: H2 at circuit + gate level for the stated tree, with measured costs and leakage. Does not support: authority to submit revocations (roots are
posted by the operator — #18), on-chain IMT maintenance, the privacy of the issuer/descendants who hold the plaintext chain (they know the revoked
certificate by construction), or any formal proof.
