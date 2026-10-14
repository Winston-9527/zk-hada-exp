# T5d — key revocation at scale (WP9, research design E3) — pre-registration

Committed and pushed BEFORE the harness is written. The protocol follows the plan (`work/plans/NEXT_ROUND_PLAN_20261013.md` WP9, PR #61).
- Base: main fd485dc (v9.2).
- **What is open.** T5 and T5b tested certificate (edge) revocation only; T5b's limits say that key revocation at scale is not tested.
  - v9.2 checks the non-membership of H(KEY_TAG, Ax, Ay) for every delegate key ent[2..D], one key slot per position.
  - Revoking one key should therefore block every chain that contains it, without listing those chains.

## World (one per seed)
- **The T5 tree:** 32 masters, M0 and M1 fan out 8 × 8 × 8; 1,230 agents and 1,198 edges. Keys are `sha256("t5d-node-" + name)`.
- **Key sharing.** A fraction **s ∈ {10 %, 30 %}** of the agents at D ≥ 2 are *reusers*.
  - A reuser's holder key is the key of a *source* agent: also at D ≥ 2, under a different parent, and not itself a reuser. The pairs are seeded.
  - A reuser's own certificate differs from the source's (another issuer and another hop), and its subtree is signed with the shared key.
  - The number of distinct delegate keys is therefore 1,198 − (number of reusers).
- **Contracts.** ZkDacGateV9, ZkDacRevocations and ZkDacRegistry on anvil.
  - **Real revoke verifier and real revoke_transition proofs**, so the revocation gas is real.
  - Accept-all verifiers for execute, mint and registration, as in T5c I1. Execution correctness is checked at the circuit level (below).
- **Revocation window:** 30 s, as in T5.

## Factors
- s ∈ {10 %, 30 %} × **revocation rate r ∈ {1 %, 10 %}** of the distinct delegate keys (sampled uniformly, seeded) × **3 seeds** = 12 worlds.
- In every world, three **methods** run from the same snapshot (paired):
  - **K: key revocation.** One revoke transaction per revoked key: entry H(KEY_TAG, key), authority = the key itself (`keyAuthority`).
  - **E-oracle: edge revocation with full knowledge.** Every certificate whose holder is a revoked key is revoked, one transaction each, by its issuer (`certAuthority`). This is the B6 "enumerate descendants" baseline in its best case.
  - **E-local: edge revocation by one issuer.** For each revoked key, only the certificate of the lowest-id agent holding it is revoked. This models one issuer that discovers a compromised key and revokes its own edge.
- **Target set** of a world = every agent whose chain contains a revoked key at a position ≥ 2. It is the same for all three methods.

## Protocol per (world, method)
1. **Before revocation:** every agent builds its action against the current state (JS witness). A seeded sample of 64 is checked with the real circuit.
2. The method's revocations are submitted as real transactions, each with `registerState`.
3. After the window (30 s + 1 block):
   - **Gate level:** every agent's pre-revocation transaction is submitted. Expected: StaleRevokedRoot for all, targets and non-targets alike (T5's availability cost). Then every agent that can construct a fresh witness submits a fresh one.
   - **Circuit level, T5b style:**
     - For every target agent, two substitute non-membership witnesses (predecessor leaf, own leaf) are built for every revoked hop or key slot and evaluated with the **real v9.2 circuit**.
     - 64 seeded non-target agents get an honest witness as controls.

## Metrics
- **False accept** (hard, for K and E-oracle): a target agent with an accepted fresh transaction, or a satisfiable substitute witness. **Must be 0.**
- **Collateral denial** (hard, all methods): a non-target agent that cannot construct a fresh witness, or whose fresh transaction is rejected. **Must be 0.**
- **Coverage:** blocked targets / targets. Expected: 1 for K and E-oracle, < 1 for E-local when s > 0. For E-local the uncovered targets are reported. They can still act: this is the method's incompleteness, not a system failure.
- **Cost:** revoke transactions, total revoke gas, IMT entries added, and `registerState` count; per method and per world.
- **Re-proving:** the number of non-target agents whose pre-built proof was invalidated (all of them, after the window).

## Statistics
- Descriptive per cell: mean ± SD over 3 seeds.
- K vs E-oracle, paired by world: the ratio of transactions and of gas, with min and max over the 12 worlds. No hypothesis test; the comparison is a cost accounting.

## Not covered
Partial knowledge between E-oracle and E-local; revocation of master keys (ent[1]), which the circuit does not key-check; dynamics over time (T5c I1).

## Outputs
- `results/worlds/s<s>-r<r>-<seed>.json`, `results/summary.json`;
- `RESULTS.md`, `RUN_RECORD.md`, `MANIFEST.sha256`.

Failures are kept. A smoke run on the Mac (not evidence) precedes the server run. Changes after this commit are amendments, recorded before the affected run.

## Amendment A1 (2026-10-14T13:35Z, before any reported run): machine
- All 12 worlds run on the **Mac M5 Pro**, by the user's decision of 2026-10-14. The pre-registration said the full run would follow the Mac smoke on the server.
- Reason: RTX6000 is saturated by E2b, and the harness is mostly single-threaded JS.
- No reported quantity depends on the machine: gas, counts and satisfiability. `revoke_prove_ms_mean` is recorded but not reported as a result.
- Runs: 3 concurrent worlds (`run_mac.sh`). The protocol is otherwise unchanged.
