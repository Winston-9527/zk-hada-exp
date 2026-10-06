# Run record: public-input layout A/B gas comparison + geth vs anvil (issue #18)
Date 2026-10-06. Env: macOS arm64; forge/anvil 1.5.1-Homebrew (solc 0.8.28, optimizer 200, no via-IR); **geth 1.17.7-stable** (Homebrew `ethereum`);
node 24.14.1, snarkjs 0.7.6. Dev ptau 2^16 + 1 contribution per zkey (not a trusted setup). All circuits D=2, MD=RD=16.

## Variants (variants/make_variants.py derives A and B from the v2 circuit; v2 itself unchanged)
| variant | public inputs | constraints | on-chain hashing |
|---|---|---|---|
| v2 (PR #14) | 5: issued_root, revoked_root, action_digest, nullifier, now | 63,685 | Poseidon(7) |
| **A** | **4** (as in the paper): issued_root, revoked_root, action_digest, nullifier; `now` folded into the digest | 63,775 | Poseidon(8) |
| **B** | 11: issued_root, revoked_root, nullifier, now + 7 action-context fields; digest internal | 63,685 | none |
Calldata of `execute` is identical in all three (644 B): in B the contract rebuilds the extra public inputs from the action it already receives.

## Contracts
- `PoseidonOpt.sol` replaces `PoseidonT8.sol`: one generic port of circomlibjs `poseidon_opt.js` for width t (here t=8 and t=9), constants in two data contracts.
  Both widths match the circuit digests (VariantV2/VariantA `test_digestMatchesCircuit`). Split into small Yul functions to avoid "stack too deep" without via-IR.
- `ZkDacGate.sol`: `ZkDacGateBase` holds all obligations (roots, clock, nullifier, context binding); `ZkDacGate` (v2), `ZkDacGateA`, `ZkDacGateB` only differ in how public inputs are assembled.
- forge: 40/40 tests (20 original v2 + 6–7 per variant: valid, replay, req_cap=0, clock, wrong `now` rejected by the proof, digest consistency, gas).

## Gas — real transactions, receipts (`python3 e2e_chains.py`, results/e2e_chains.json)
Same fixtures (one set of proofs, chain id 1337) and same deployment nonces on every client.
| client | v2 execute #1 / #2 | A execute #1 / #2 | B execute #1 / #2 |
|---|---|---|---|
| anvil --hardfork cancun | 661,831 / 624,867 | 700,514 / 663,502 | **377,696 / 340,696** |
| anvil --hardfork osaka | identical | identical | identical |
| geth --dev, genesis without `bogotaTime` (Osaka only) | identical | identical | identical |
| geth --dev as shipped (Osaka **+ Bogota** @0) | 928,091 / 722,287 | 966,774 / 760,922 | 642,556 / 436,716 |
#1 = first execute (fresh nullifier slot + target slots 0->non-zero), #2 = steady state (fresh nullifier slot only).

forge (gasleft, results/forge_gas_variants.txt): verifyProof 215,965 (4 inputs) / 222,675 (5) / 263,433 (11) => ~6.7k gas per extra public input.

## Findings
1. **B is the cheapest: 377,696 vs 661,831 (v2) vs 700,514 (A), i.e. −43% vs v2 and −46% vs A.** B pays ~47k more in the verifier (11 vs 4 inputs) but avoids on-chain Poseidon.
   A (paper-consistent 4 inputs) is the most expensive because Poseidon(8) on-chain costs ~370k with this implementation; A would only beat B if Poseidon(8) cost < ~47k.
   My Poseidon port is a straightforward loop implementation; an optimised version would narrow the gap, but how far was not measured.
2. **geth vs anvil: identical gas under the same fork.** Per-frame call traces (`debug_traceTransaction` callTracer) match exactly; e.g. the verifier frame is 255,392 gas in both.
   The large differences with geth 1.17.7's default `--dev` genesis come entirely from the **Bogota** fork that it activates at genesis: new storage slots become much more expensive
   (target frame writing two new slots: 225,183 vs 49,243; nullifier slot: about +88k). Verifier and precompile costs are unchanged. I have not checked the Bogota specification itself; the attribution
   rests on removing `bogotaTime` from the same genesis, which makes geth match anvil exactly.
3. The paper's "geth --dev" gas number is therefore only meaningful together with the geth version / active fork. A current geth `--dev` silently includes a future fork.
4. Paper text (limitation, line 600) cites "state rent" as a difference between dev chain and mainnet; Ethereum has no state rent. The real source of differences is the active fork (and, on L2s, data publication cost).

## Reproduce
`python3 variants/make_variants.py` (from variants/), compile + setup per RUN_RECORD; `VARIANT=v2|A|B node gen_fixtures.mjs`; `cd foundry && forge test`;
`SCRATCH=<tmp> python3 e2e_chains.py > results/e2e_chains.json` (starts geth twice and anvil twice on ports 8548/8547; uses anvil's public test key, local chains only).
Hashes of zkeys/vks/r1cs: variants/MANIFEST.sha256, results/MANIFEST.sha256. Fixture sha256 per variant: results/e2e_chains.json.

## Not done
mainnet-fork / testnet; optimised Poseidon; D=3/4 (proving time only; on-chain gas does not depend on D).
