# T3 attack pre-registration (issue #5) — committed BEFORE any attack is run
Target: v2 circuit `work/t2_circuit_fix/zkdac_v2` (D=1..4, MD=RD=16) and, where stated, the committed RQ108 baseline (46,593).
Goal: inputs that are **semantically illegal but accepted** (witness generation succeeds), not inputs that crash the generator.
Method: every attack is judged by an independent plaintext oracle (`oracle.mjs`, written from the authorization semantics, not from the Circom; uses poseidon-lite, set lookups instead of Merkle/SMT proofs). Verdict classes:
FALSE_ACCEPT (circuit accepts, oracle rejects) => the related claim FAILS; FALSE_REJECT (oracle accepts, circuit rejects) => completeness gap; AGREE.
Layering rule: behaviour that is outside the circuit by design (nullifier set, root freshness, clock) is reported as POLICY-DEPENDENT, not hidden.

| ID | Attack | Expected oracle verdict | Target |
|----|--------|------------------------|--------|
| A01 | Switch zeroing: disable eddsa/merkle/revocation checks with arbitrary signature and roots | reject | baseline (v2: no switches, structural) |
| A02 | Prefix/truncated chain presented with the *wrong* terminal secret (attacker knows only an intermediate public key) | reject | v2 |
| A02b| Prefix chain with the correct intermediate secret presented to the shorter-depth circuit | accept (legit) | v2 |
| A03 | Illegal padding: append an unregistered zero-capability self-signed hop (D+1 circuit); identity-point/zero keys as hop keys | reject | v2 |
| A04 | Signature reuse with replaced field: keep sig_i, change cap_i / expiry_i / holder key of cert i | reject | v2 |
| A05 | Chain splice: cert0 of registered chain A + certs 1.. of registered chain B, B's issuer != A's holder (continuity break); and splice at a genuinely shared entity | reject; accept | v2 |
| A06 | Holder-key substitution: replace terminal holder key + secret with the attacker's own, keeping signatures | reject | v2 |
| A07 | Nullifier without holder secret / second nullifier for the same action via secret alias (s+l) / via other secret | reject | v2 + baseline (baseline nullifier secret is free: same holder mints unlimited nullifiers) |
| A08 | Registry mis-binding: Merkle path of cert j used for cert i; path of another tree index | reject | v2 |
| A09 | Non-boolean Merkle path bits (2, p-1) | reject | v2 |
| A10 | Replay of an accepted statement (same proof/nullifier twice) | oracle with spent-set rejects 2nd | POLICY-DEPENDENT (circuit alone accepts both; defence = verifier nullifier set, tested in T4/E7) |
| A11 | Cross-context replay: same witness, different chain_id / verifier / method / amount in the action | reject (digest mismatch) | v2 |
| A12 | Revoked ancestor with live descendants: (a) honest proof after revoking cert i, (b) stale non-membership proof against the new root, (c) proof against a stale (pre-revocation) revoked_root | reject, reject, reject under 'current root' oracle | v2; (c) POLICY-DEPENDENT (root freshness window) |
| A13 | SMT depth overflow: revoked cert whose key shares >= RD low bits with another revoked key; forged exclusion with oldKey=other key. Also honest cert whose path would exceed RD (liveness) | reject; accept (liveness probe) | v2 |
| A14 | Time manipulation: now = 0 for expired certs (clock lie), now = p-1 | reject only if clock is trusted | POLICY-DEPENDENT (`now` must be checked against block time) |
| A15 | Capability smuggling: bit >= 32 (2^32+1), child cap with extra high bit, req_cap outside terminal cap | reject | v2 |
| A16 | Expiry inversion: child expiry > parent expiry; expiry >= 2^64 wrap | reject | v2 |

Pass criteria: for v2, zero FALSE_ACCEPT outside POLICY-DEPENDENT rows. Baseline rows are expected FALSE_ACCEPT (that is the point of including it).
Anything found after this list is added below as `Post-registration additions` with the date, never edited into the table above.
