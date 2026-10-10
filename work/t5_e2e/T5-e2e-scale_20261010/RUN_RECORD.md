# Run record: T5 (#7)
Date 2026-10-10, 02:36–04:35 UTC. Apple M5 Pro (15 cores, 48 GiB), macOS 26.4, node 24.14.1, snarkjs 0.7.6, ethers 5.7.2,
anvil 1.5.1 (`--hardfork prague --chain-id 31337 --gas-limit 30000000`, port 8560, state dumped to `state/anvil_state.json`).
anvil's default mnemonic accounts are public test keys (local only).
Commits: pre-registration 1d939e2; scripts 5a91db4 (after smoke runs in a scratch world); run on branch t5-e2e.
Command: `./run_t5.sh` (log of exit codes: `results/logs/steps.txt`; every step exit 0). The first launch did not start (missing `results/logs/` for the
outer redirect) and was relaunched unchanged.
Analysis: `node analyze.mjs > results/analysis.json`; post-hoc `python3 gas_vs_note_index.py > results/gas_vs_note_index.txt`.
`state/` (creds.json, state.json, anvil_state.json; 153 MB) is not committed: it is regenerated deterministically by build_world.mjs except for the anvil
timestamps; its sha256 at the end of the world build is in `results/world_build.json`, and the final hashes are in MANIFEST.sha256.
Seeds: t5-agents-D, t5-block-b, t5-warm-b, t5-cold, t5-revoke, t5-revtx-<rate>-{d,f}, t5-issuance; bootstrap / permutation seeds in analyze.mjs.
