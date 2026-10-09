# #18 contract obligations on the main gate (v7 mode C) — pre-registration (committed BEFORE any run)
Issue #18 (T4 / E7). Branch `t18-obligations` from main 2eeac99. Scope = what the research design requires of the contract layer:
- P1 (line 83): roots, nullifiers, clock and the action context are part of the verification relation; the contract binds them.
- C2 (line 97): **a revocation submission must prove its authority; knowing a handle must not suffice to revoke others.**
- E7 (line 180): receipts, return values and state must agree; gas broken down; rollback / re-entry / duplicate submission; a second client cross-checks.
Not in scope (stated, not done): mainnet-fork / testnet (no RPC configured), L2 data pricing, issuance authority for the issued tree (operator-posted).

## Part 1 — obligations on ZkDacGateV7 with the real mode C D = 4 proof (forge)
Earlier tests exist for the v2/v3 gates (t4_contracts/RUN_RECORD.md) and V7 has replay / ciphertext / TPK tests. Ported to V7:
| ID | Case | Expected |
|---|---|---|
| G1 | clock: nowTs = block.timestamp; = ts − skew; = ts − skew − 1; = ts + 1 | accept, accept, BadClock, BadClock |
| G2 | business call reverts | whole tx reverts, nullifier not spent; the same proof succeeds once the target accepts |
| G3 | target re-enters execute with the same proof from its callback | NullifierSpent (re-entrant replay) |
| G4 | A11a: the proof submitted with a different chainId / gate address / method / amount / params / nonce / target | InvalidProof (or UnknownMethod for a disabled method) |
| G5 | A11-req: method whose requiredCap differs from the proof's req_cap | InvalidProof |
| G6 | disabled method | UnknownMethod |
Mapping of all 18 T3 v7 POLICY rows to the contract test that closes them: `POLICY_CLOSURE.md` (written with the results).

## Part 2 — authorized, monotonic revocation (new)
Today `updateRoots` lets the operator post any revoked root (E3 found that re-posting an old root "un-revokes"). Replacement:
- **Circuit `revoke_transition`** (public: old_root, new_root, entry, next_index). Proves (a) authority — knowledge of the secret scalar sk of
  - the issuer of the certificate whose hash is `entry` (cert = Poseidon(i, issuer, holder, cap, expiry)), or
  - the holder of that certificate (self-revocation), or
  - the key A for a key entry H("zkrk", A);
  and (b) a correct indexed-Merkle-tree insertion of trunc(entry) into old_root giving new_root: non-membership via a low leaf, low leaf re-pointed to the
  new key, new leaf (key, low.next_index, low.next_value) written into the empty slot `next_index`.
- **Contract `ZkDacRevocations`**: holds the revoked root and the leaf count; `revoke(proof, newRoot, entry)` verifies the proof against (current root,
  newRoot, entry, count), retires the old root (window Δ), stores the new one, emits (entry, index). No function sets an arbitrary root.
  **Gate `ZkDacGateV7R`** = ZkDacGateV7 with the revoked-root check delegated to `ZkDacRevocations`.
| ID | Case | Expected |
|---|---|---|
| V1 | issuer of cert hop 2 revokes it | proof verifies; root advances; count + 1 |
| V2 | holder of cert hop 2 revokes its own incoming cert | accept |
| V3 | owner of key ent[3] revokes the key entry | accept |
| V4 | ancestor that is not the issuer (ent[1]) tries to revoke cert hop 2 | no witness (unsatisfiable) |
| V5 | knows entry and both public keys, wrong sk | unsatisfiable |
| V6 | malformed transition: wrong new_root; entry already revoked; low leaf not the predecessor; next_index not empty; next_index ≠ count | unsatisfiable or contract revert |
| V7 | replay of an applied transition proof | revert (old root no longer current) |
| V8 | two revocations prepared against the same root | first succeeds, second reverts; rebuilt on the new root succeeds |
| V9 | un-revoke: any attempt to set an earlier root | impossible (no such function; old root only accepted inside Δ) |
| V10 | gate integration: v7 C D=4 action proof against R0; issuer revokes cert hop 2 | accepted at t0 + Δ, StaleRevokedRoot at t0 + Δ + 1 |
| V11 | off-chain IMT replayed from the event log equals the on-chain root | equal after every revocation |
Also report constraints, prove time (N = 10), verifyProof and revoke gas.

## Part 3 — real receipts, two clients
anvil 1.5.1 (hardforks cancun and prague) and geth 1.17.7 `--dev` (its default fork): deploy verifiers, registry, gate V7R, revocations; 2 registrations,
execute (valid), execute replay (must fail), revoke (valid), execute against the old root after Δ (must fail). Record status, gasUsed, logs.
Expected: identical status on both clients; identical gasUsed for the same fork; breakdown of the execute receipt into intrinsic 21,000 + calldata
(EIP-2028; floor of EIP-7623 under prague) + verifyProof + nullifier SSTORE + business call + events (from forge gasleft deltas).

## Pass criterion
All "reject/revert" rows reject, all "accept" rows accept, no unauthorized revocation accepted, clients agree. Deviations reported, raw outputs kept.
