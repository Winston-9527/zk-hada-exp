# Run record: v4 main circuit (layout C + indexed Merkle tree revocation) — issues #4, #24
Date 2026-10-08. Env: Apple M5 Pro (15 cores), macOS arm64, node 24.14.1, circom 2.2.3, snarkjs 0.7.6, circomlib 2.0.5, circomlibjs 0.1.7, ethers 5.7.2.
Decision (#24): replace v3's circomlib SMT (RD=16) by an IMT of depth 20 (≤ ~10^6 revocations). v3 stays unchanged in ../zkdac_v3 (archive: ../../ARCHIVE_pre_v4.md).
Run: `npm ci`; `circom circuits/main_dN.circom --r1cs --wasm --sym -l node_modules -o build/dN` (N=1..4); `node scripts/smoke.mjs`;
`node scripts/mutate_v4.mjs N > results/mutations_dN.json`; `scripts/ablation.sh`. r1cs sha256: results/MANIFEST.sha256.
The generator needs `npm ci` in ../zkdac_v2 and ../zkdac_v3 as well (lib_v4 builds on lib_v3, which builds on the v2 generator).

## Circuit
`circuits/zkdac_chain_v4.circom` = `revocation_imt/circuits/zkdac_chain_v3_imt.circom` (validated in PR #25) promoted to a maintained source; `circuits/imt.circom`
copied from revocation_imt. Public inputs unchanged from v3: issued_root, revoked_root, nullifier, now, ctx_hash, act_req_cap. Parameters ZkDacChainV4(D, MD=16, RD=20).

## Constraints (results/constraints_ablation.csv)
D=1..4: 36,079 / 66,607 / 97,135 / 127,663 (identical to PR #25's v3+IMT). Per hop: +520 per revocation-tree level, +520 per issued-tree level.
At equal revocation depth 16, v4 (119,343) is below v3/SMT (120,691). **Capacity of the 2^17 ptau: D=4 fits up to IMT depth 21** (depth 22 = 131,823 > 131,072).

## Mutations (witness level)
| D | single-field mutations | accepted | semantic cases | unexpected |
|---|---|---|---|---|
| 1 | 91 | now | 17 | none |
| 2 | 173 | now | 23 | none |
| 3 | 255 | now | 28 | none |
| 4 | 337 | now | 33 | none |
Only `now` +1 (another valid statement) is accepted; the benign isOld0 fields of the SMT version no longer exist. Semantic cases as in v3 plus, for every hop,
revoking that certificate and then trying: stale witness vs new root, predecessor leaf, own leaf, forged skip leaf, end-of-list leaf — all rejected.
