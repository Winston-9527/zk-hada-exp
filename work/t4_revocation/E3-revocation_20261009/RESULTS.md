# E3 revocation of hidden delegation branches (H2) — results (issues #6, #18)
Pre-registration: `PREREGISTRATION.md` (commit 907c23b, pushed before any run). Raw outputs: `results/`. Run details: `RUN_RECORD.md`.

## Verdict on H2 and the stop condition (research design line 321)
**H2 holds at circuit + gate level for the tested world.** Revoking one hidden edge blocks exactly the chains that contain it; every sibling and unrelated chain
stays acceptable after a witness refresh. One revocation is one IMT entry, whatever the number of descendants. Revocation does not publish the lineage and does
not require re-signing any branch. The stop condition is not triggered. Caveats: revocation takes effect only after the gate window Δ (by design, measured);
roots are posted by the operator (#18); certificate entries are recognisable by anyone who knows both keys of the edge and has a narrow prior on (cap, expiry)
(L3).

## E3.1 world W (results/e31_world.json; 598 rows, 0 differ from the pre-registered expectations)
46 holder chains: human H with master M, 4 + 12 + 24 delegates, plus node X with two parents (S1, S4), and human H' with 3 chains. Witness-level checks on the v7
mode C circuit. Expected outcomes come from node-name semantics, not from hashes.
| Scenario | Revoked | Targets rejected | Non-targets accepted after refresh |
|---|---|---|---|
| R0 | nothing | — | 46/46 |
| R1 | root edge H→M | 43/43 | 3/3 (H') |
| R2 | middle edge M→S2 | 10/10 | 36/36 |
| R3 | deep edge S2→S21 | 3/3 | 43/43 |
| R4 | leaf edge S21→S211 | 1/1 | 45/45 |
| R5 | key of S3 | 10/10 | 36/36 |
| R6 | unrelated entry | — | 46/46 |
| R7a | cert S1→X | 1/1 (X via S1) | 45/45, **including X via S4** |
| R7b | key of X | 2/2 (both X chains) | 44/44 |
Certificate revocation is per edge (R7a: X keeps acting through its other parent); key revocation is per key (R7b: both paths die).

Adversarial witnesses for every target (R1–R5, R7):
- **A1** stale witness + new root: 70/70 rejected.
- **A2** stale witness + old root: 70/70 **accepted** — POLICY, as pre-registered. The circuit cannot know which root is current; the gate stops this once
  the old root is older than Δ (E3.5).
- **A3** every IMT leaf (22) tried as the low leaf of the revoked entry: 0 accepted in all 7 scenarios.
- **A4** the revoked node delegates to a fresh key Z: no witness can be built (6/6).
- **A5** re-issuance: an unrevoked delegator (S1, or S22 for R4) gives the revoked node's key a new certificate. Accepted for R2/R3/R4 (POLICY: a new,
  explicit authorization by an unrevoked party). Rejected for R5, because the key itself is revoked.
- **A6** dropping the revoked hop (reusing the revoked certificate's signature): rejected (R2, R3, R5). For R1, witness construction is impossible because the
  forged hop-0 certificate is not registered. Not applicable to R4/R7 (no descendant below the revoked node).

**Ablation L (revocation checked for the last certificate and key only; `ablation/leafonly.diff`).** Depth-4 descendants of a revoked edge or key:
**14/14 accepted** (R2 6/6, R3 2/2, R5 6/6), while all non-targets are still accepted. Blocking them under L needs one insert per descendant (6, 2, 6 inserts),
and the operator must know who the descendants are. This is the causal evidence that the per-hop check is what blocks descendants.

## E3.2 update cost vs number of descendants (results/e32_e33.json; IMT pre-filled with 1,000 entries; 8 branches of k descendants under one master)
| k | per-hop (ours): inserts / Poseidon / ms | enumerate: inserts / Poseidon / ms | root-only: collateral chains |
|---|---|---|---|
| 1 | 1 / 42 / 2.0 | 2 / 84 / 3.8 | 15 |
| 10 | 1 / 42 / 1.9 | 11 / 462 / 21.1 | 78 |
| 100 | 1 / 42 / 1.9 | 101 / 4,242 / 191 | 708 |
| 1,000 | 1 / 42 / 1.9 | 1,001 / 42,042 / 1,963 | 7,008 |
| 10,000 | 1 / 42 / 1.9 | 10,001 / 420,042 / 20,081 | 70,008 |
- Per-hop: constant; publishes 1 entry, so the size of the revoked subtree stays hidden.
- Enumerate: linear in k; publishes k + 1 entries, which reveals the subtree size, and the operator must know the descendants.
- Root-only: constant cost, but kills every other chain of the human.
- On chain, every strategy is one `updateRoots`: **26,997 gas** (forge, cancun; `results/forge_e35.txt`).
- The wall times use the generators' IMT, whose `lowIndex` is a linear scan. The Poseidon counts (42 per insert = 2 leaves × 21 levels) are the
  implementation-independent cost.

## E3.3 witness maintenance for the other holders
Revocation IMT, holders with 7 entries each (D = 4). b = inserts in one root update.
| R (pre-filled) | b | invalid under new root | low leaf changed | changed path siblings per witness, mean (max) | broadcast | full IMT download |
|---|---|---|---|---|---|---|
| 1,000 | 1 | 100 % (all N) | 0–0.4 % | 1.0–1.5 (2) | 2 leaves, 1,480 B | 96 KB |
| 1,000 | 10 | 100 % | 2–4 % | 3.8–4.1 (8) | 20 leaves, 14.8 KB | 97 KB |
| 1,000 | 100 | 100 % | 14–16 % | 7.8–8.0 (11) | ~190 leaves, ~141 KB | 106 KB |
| 10,000 | 1 | 100 % | 0–0.01 % | 1.2–2.0 (2) | 1,480 B | 960 KB |
| 10,000 | 10 | 100 % | 0–0.2 % | 4.1–4.3 (6) | 14.8 KB | 961 KB |
| 10,000 | 100 | 100 % | 1.3–1.9 % | 7.2–7.4 (12) | ~146 KB | 970 KB |
(N ∈ {32, 128, 1024}: the fractions do not depend on N; per-cell numbers in the JSON.)
- **Every root update invalidates every holder's witness** if the gate accepted only the current root. Each witness changes in only 1–2 sibling nodes per
  insert, so the window Δ (E3.5) is what makes this usable.
- **Broadcast update (no query that reveals what the holder holds):** the operator publishes the changed leaves with their final paths. Every holder updates
  locally, and the result **equals full recomputation for every witness: 49,728 / 49,728** across all cells. Size is ≈ 1.5 KB per insert.
- Costs and trade-offs:
  - Local update costs 5.5–8 ms of CPU per holder per insert (7 witnesses, JS Poseidon).
  - Full recomputation (0.1–0.6 ms) assumes the holder already has the whole tree: a 96 KB–970 KB download, or a server query that leaks its entries.
  - At b = 100 and R = 1,000 the broadcast (141 KB) is larger than the whole tree (106 KB). Bulk updates favour a full download.
- Issued tree (depth 16): after b issuances 100 % of paths change. 1 sibling for b = 1; mean 1.3–2.0 (max 4) for b = 100. Same structure, same remedy.

## E3.4 observation leakage (results/e34_leakage.json)
| ID | Result |
|---|---|
| L1 | public observer: 0 of 23 revocation entries (incl. 3 real revocations) match any of 994 public words of 46 actions, exact or truncated |
| L2 | an auditor who opened 3 actions (11 keys) links the key entry of S3, revoked and seen in an opened chain. **Key entries are linkable by anyone who knows the key** — by design of H("zkrk", A) |
| L3 | **certificate entries carry no salt.** Knowing both keys of S2→S21 and the prior cap ⊆ 0x3F, expiry ∈ [1000, 10000] found the entry after 137,016 Poseidon(7) calls (35 s, 3,921 hashes/s, single-thread JS). Extrapolated single-thread costs: 32-bit cap unknown + expiry to the second within a year ≈ 1.1 M years; cap ⊆ a known 8-bit parent cap + expiry to the second ≈ 24 days, to the hour ≈ 10 minutes. Native or GPU hashing is orders of magnitude faster. |
| L4 | per-hop: 1 entry per revocation (subtree size hidden); enumerate: k + 1 entries (subtree size leaked) — E3.2 |
| L5 | query-by-key witness fetch would show the server the holder's entries; broadcast update (1.5 KB per insert) or full download (96–970 KB) avoid it — E3.3 |
Who can recognise a revocation: the issuer and every descendant of the edge (they hold the plaintext certificate), anyone who knows a revoked key (L2), and
anyone with both keys plus a narrow (cap, expiry) prior (L3). The public observer cannot (L1).

Not measured: timing correlation (actions stop after a revocation), network metadata.

## E3.5 window Δ and revocation latency
Forge, real v7 C D=4 proof (results/forge_e35.txt). For Δ ∈ {0, 12, 60, 240, 3600} s, a proof against the retired root is accepted at t0 + Δ and rejected
with StaleRevokedRoot at t0 + Δ + 1 (5/5). **Revocation latency = Δ after the update is included.** Δ = 0 still accepts in the same second (`<=`).

Monte Carlo (results/e35_sim.json; 10^5 honest actions per cell; simulation matches the closed form within 0.002):
| update rate | Δ = 0 | Δ = 12 s | Δ = 60 s | Δ = 240 s |
|---|---|---|---|---|
| 1 / hour | 0.57 % | 0.25 % | 0 | 0 |
| 1 / min | 28.8 % | 13.0 % | 0 | 0 |
| 1 / 12 s | 81.0 % | 48.6 % | 0 | 0 |
Honest actions rejected as stale fall to 0 once Δ ≥ prove + inclusion time (≈ 26.5 s max in this model). The revoked holder's exposure is Δ. With 12 s blocks,
**Δ ≈ 30–60 s removes honest failures at a revocation latency of under a minute.** Model parameters, not measurements: inclusion delay, Poisson updates.

Two additional forge tests (not pre-registered, recorded for #18):
- A second root update does not extend the old root's deadline (rejected at t0 + Δ + 1).
- **The operator can "un-revoke"**: re-posting a retired root resets its retirement, and old proofs are accepted again (POLICY). The authority of whoever
  posts roots matters (#18).

## Deviations from pre-registration (transparent)
- The pre-registration said "41 holders of H". The world built from the same description has 43 chains under H (41 + the two X chains), 46 in total. R1
  therefore has 43 targets.
- A4/A6 rejections partly come from "no witness can be built" (the generator refuses), not from a circuit evaluation. A3, the exhaustive low-leaf search,
  covers forged witnesses for the same entries. A6 is not applicable when the revoked node has no descendant (R4, R7a, R7b).
- Script errors before complete outputs existed (stderr kept as `results/e31_world_run{1,2}_crashed.stderr`):
  - run 1: the ablation enumeration step included holders added by A4 (no pre-revocation witness);
  - run 2: A6 assumed a descendant below the revoked key (R7b).
  Both were fixed, and the full run was restarted from scratch.
- Forge test development: the first versions failed with NotOperator (a view call inside the pranked call consumed `vm.prank`, the pitfall in HANDOFF §6).
  Then an inserted comment swallowed the gas-measurement statement (reported 0 gas). Both fixed before the recorded run.

## Assessment of L3 against the research design (added 2026-10-09, user decision: disclose, do not change the circuit)
- Privacy target of the first version (research design line 27): hide lineage from the **public verifier**; what each participant knows is listed separately.
  L1 shows the public verifier cannot recognise any revocation entry → target met.
- H2 and its stop condition (lines 58, 321) do not depend on salting: E3.1/E3.2 hold either way.
- The leakage function (line 253) already admits "handles exposed by design after revocation"; L2/L3 fall in that class.
- Disclosed deviation: line 97 proposes revocation handles derived from an independent secret. The implementation uses the unsalted certificate hash, so
  anyone who knows both keys of an edge and has a narrow prior on (cap, expiry) can recognise its revocation. The issuer and the descendants of the edge know
  it anyway; an auditor who opened an action already knows the chain's keys, so the increment is "this edge was revoked". Line 97's core requirement — that
  knowing a handle must not suffice to revoke — is about revocation authority (#18), not salting.
- Paper wording (proposed for party A): leakage L includes "a revoked certificate entry is recognisable by parties who know both endpoint keys and a prior on
  (cap, expiry); not by the public verifier". A salted handle (new circuit, setup, T2/T3/E3 re-run, ≈ 1 day) is left as an option if a stronger claim is
  needed.

## Limits
- Witness-level evaluation, apart from E3.5's real proof (T2 established witness = proof level for the public fields).
- One world shape.
- Random field elements stand in for Poseidon outputs in E3.2/E3.3.
- JS timings.
- Root-posting authority (#18) and on-chain IMT maintenance not addressed.
- No formal proof.
