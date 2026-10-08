# Run record: registration proof (R1 + R2) — issue #17
Date 2026-10-08. Env: Apple M5 Pro (15 cores), node 24.14.1, circom 2.2.3, snarkjs 0.7.6, circomlib 2.0.5, @zk-kit/binary-merkle-root.circom 2.0.0,
@semaphore-protocol/identity + group 4.14.3, poseidon-lite 0.3.0. Dev ptau 2^17 from `../ptau` (not a trusted setup).
Run: `npm ci`; compile `circuits/main_reg_{16,20,32}.circom` with `-l node_modules/circomlib/circuits -l node_modules/@zk-kit/binary-merkle-root.circom/src -o build/rN`;
`node scripts/check_key_interop.mjs`; `node scripts/test_register.mjs > results/register_tests.json`; zkey + `node scripts/prove_bench_reg.mjs 10`.
Decisions implemented (from #17): R1 lives only in the registration proof; human key = Semaphore v4 identity = ent[0] of the v4 chain ("key merged").

## Circuit (circuits/register.circom, ZkDacRegister(MAX_DEPTH))
Public: group_root, domain, nf_domain, leaf0. Proves knowledge of a canonical secret scalar s (< l) with A = s·Base8, Poseidon(A) ∈ Semaphore group
(@zk-kit BinaryMerkleRoot, as in Semaphore v4), nf_domain = Poseidon(TAG_REG="zkdr", s, domain), leaf0 = Poseidon(0, A, master, cap0, expiry0) — exactly the v4
hop-0 certificate hash. Depth is bounded in-circuit (BinaryMerkleRoot returns 0 for depth > MAX_DEPTH, which equals the empty-group root).
No EdDSA check: knowledge of s already authorises; every v4 action proof checks the hop-0 signature anyway.
Constraints: MAX_DEPTH 16 / 20 / 32 = 15,340 / 17,436 / 23,724 (my earlier estimate 10–15k was low).

## Results
- Key interop (results/key_interop.json): 50/50 Semaphore identities — same public key and secret scalar in zk-kit and circomlibjs, and a circomlibjs EdDSA-Poseidon
  signature verifies under zk-kit. zk-kit's `deriveSecretScalar` reduces mod l, like the v4 generator (resolves the #17 open item).
- Semaphore source check: `@semaphore-protocol/circuits` 4.14.3 `semaphore.circom:68` — nullifier = Poseidon(scope, secret); secret < l enforced; commitment = Poseidon(A).
- register_tests.json (MAX_DEPTH 20, real Semaphore group of 37, LeanIMT depth 6): 37/37 members register; R1 properties hold (same human+domain → same nf whatever
  the master; other domain → different nf; 40 humans → 40 distinct nf; differs from Semaphore's own nullifier for scope = domain, computed for all 40);
  14/14 negatives rejected (other member's secret, s + l alias with and without matching nf, non-member, depth > MAX with root 0, nf for another domain / unrelated
  secret / +1, leaf0 for another master, larger cap, cap ≥ 2^32, expiry ≥ 2^64, hop index 1, tampered sibling).
- End-to-end with the v4 action circuit (D = 1, 2, 4): ent[0] of the action chain is the Semaphore identity's key; registration leaf0 == action cert0; both accepted.
  Needed a backward-compatible generator option `entPrv` in `t2_circuit_fix/zkdac_v2/scripts/lib.mjs`; default instances verified byte-identical before/after
  (sha256 of 8 instances D=1..4 × 2 seeds: ae4fc7be…58cd unchanged).
- Proofs: zkey (setup 14 s, `zkey verify` OK; hashes zk/MANIFEST.sha256); 10/10 verified, group of 1,000 (depth 10): witness 52.5 ± 1.5 ms,
  prove 310.8 ± 38.0 ms, verify 6.5 ± 0.3 ms (results/prove_bench_reg.json). Solidity verifier zk/Groth16VerifierRegister.sol.

## Not done (needs a design decision, see #17)
On-chain enforcement that only registered hop-0 certificates enter the issued tree, and automatic revocation of a replaced master; no salt in cert0 (analysis in #17).
Minor doc issue found: the v4 action-nullifier tag 1952805748 is commented as "zkdc" but is ASCII "test" (any distinct constant is fine; not changed).
