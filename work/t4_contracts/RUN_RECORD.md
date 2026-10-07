# Run record: T4 contract obligations + E7 gas (issue #18)
Date 2026-10-06. Env: macOS arm64; forge/anvil 1.5.1-Homebrew, solc 0.8.28, evm cancun, optimizer 200; forge-std 314b0bf
(`forge install foundry-rs/forge-std` into foundry/lib, not committed); node 24.14.1, snarkjs 0.7.6, circomlibjs 0.1.7, ethers 5.7.2.

## Setup
- Circuit: v2 `main_d2` (D=2, MD=RD=16, 63,685 constraints, 5 public inputs). D=2 chosen because it fits the dev ptau 2^16 from T1;
  on-chain logic and verifier gas depend on the number of public inputs (5), not on D. **Dev ptau + 1 contribution: not a trusted setup.**
- `zk/`: `snarkjs groth16 setup` -> `d2.zkey` (not committed, sha256 in results/MANIFEST.sha256), `vk_d2.json`, `Groth16Verifier.sol` (snarkjs export).
- `node gen_fixtures.mjs` -> real proofs (fullProve, ~0.85 s each on this laptop) -> `foundry/test/fixtures.json`.
  Anvil variant: `GATE=0x5FC8…5707 TARGET=0xDc64…F6C9 NOW=2000000100 OUT=anvil_fixtures.json node gen_fixtures.mjs` (addresses = deployer nonces 5/4).
- `cd foundry && forge test -vv` ; `python3 e2e_anvil.py > results/e2e_anvil.json` (starts anvil on :8547, uses anvil's public test key #0, local only).

## Contract design (src/ZkDacGate.sol)
Verifier-side obligations that T3 showed the circuit cannot enforce alone:
1. root freshness: issued/revoked roots must be current, or retired <= window seconds ago (separate windows; revocation lag = revokedWindow + operator publication delay);
2. clock: `block.timestamp - clockSkew <= now <= block.timestamp`;
3. replay: nullifier spent set, set before the external call (CEI);
4. context binding done by the contract, not the prover: chain_id = block.chainid, verifier = address(this), required capability = requiredCap[method],
   params_hash = keccak(abi.encode(target, params)) mod p (target is bound — without this a relayer could redirect a proof to another target).
On-chain `action_digest` needs Poseidon with 7 inputs; circomlibjs' generator fails for t=8 (stack-depth assertion), so `src/PoseidonT8.sol` ports
circomlibjs `poseidon_opt.js`; its 1,216 constants live in two data contracts read via EXTCODECOPY. Correctness: test_onchainPoseidonMatchesCircuitDigest
(on-chain digest == circuit public signal for 3 independent proofs).

## Results
forge: 20/20 tests pass. Covered: valid execute; replay (A10) rejected; distinct nonce -> distinct nullifier; re-entrant replay from the business callback rejected
(NullifierSpent); business revert rolls back the nullifier and the same proof can be retried; prover-chosen req_cap=0 rejected; other chain id, target substitution,
amount substitution rejected; disabled method rejected; clock: within skew ok, too old / future rejected (A14); unknown root rejected; only operator updates roots;
**revocation lag measured as a boundary**: proof against the pre-revocation root accepted at t = revoke + Δ, rejected at t = revoke + Δ + 1; Δ = 0 rejects one second after
revocation (A12c closed by the contract).

Gas (D=2; first execute on a fresh anvil, cancun):
| component | gas | source |
|---|---|---|
| execute tx, first (cold storage) | **636,224** | anvil receipt |
| execute tx, second (steady state) | **599,212** | anvil receipt |
| intrinsic 21,000 + calldata (644 B) | 28,040 | EIP-2028 count |
| Groth16 verifyProof (5 public inputs) | 222,627 | forge gasleft, includes cold account access |
| on-chain Poseidon(7) action digest | 308,854 | forge gasleft (anvil eth_estimateGas incl. intrinsic: 317,969) |
| remainder: checks, SLOAD roots/method, SSTORE nullifier, business call (2 cold SSTOREs in MockTarget), event | ~76,700 | difference |
`eth_estimateGas` is NOT usable for verifyProof alone: the snarkjs verifier returns false instead of reverting when the pairing precompile runs out of gas.

## Findings
- **Poseidon(7) on-chain costs more than the Groth16 verification itself (~309k vs ~223k, ~49% of the tx).** My port is a straightforward loop implementation;
  a generated, unrolled Yul version would be cheaper, but the design alternative is bigger: expose the 7 action-context fields as public inputs
  (no on-chain hashing; each extra public input costs one ecMul+ecAdd in the verifier, roughly 6–7k gas -> ~45k, an estimate, not measured). That changes the circuit (5 -> 11 public inputs) and needs a new zkey and T2/T3 re-runs. **Decision needed.**
- The paper's 235,891 gas is in the same range as verifyProof alone here (222,627 with 5 inputs) but is not a full authorization transaction: with context binding, replay protection and a business call, the measured total is ~600k.
- Revocation is effective only through the contract: revocation lag = Δ (+ operator delay). Δ must exceed proving (~0.85 s at D=2 locally) plus inclusion time, otherwise honest in-flight proofs fail.

## Not done
- mainnet-fork / testnet (no RPC configured); L2 calldata pricing; cold vs warm breakdown per opcode.
- Registration contract for #17 (nf_domain map, replace + auto-revoke) — needs the registration circuit first.
- D=3/4 proofs (ptau 2^17; `ssh 201` unavailable) — on-chain gas is independent of D, proving time is not (T5).
- Root publication is trusted to an operator (no on-chain tree maintenance); stated as an assumption.
