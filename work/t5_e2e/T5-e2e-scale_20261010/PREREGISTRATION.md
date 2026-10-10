# T5 — end-to-end lifecycle latency and scale on v9 (issue #7) — pre-registration (committed and pushed BEFORE any run)
Base: main 5ba36e8 (v9 main circuit, #42; T3 v9, #43). Research design §7 E4 (`docs/research/proposals/2026-09-19_RESEARCH_DESIGN.md`, lines 177, 211–235, 291–300) and Q6.
Machine: Apple M5 Pro (15 cores, 48 GiB), node 24.14.1, snarkjs 0.7.6, anvil 1.5.1 (prague). Everything runs locally (no remote host).

## What T5 must answer (Q6)
Q6: "the joint construction keeps usable latency, throughput and revocation cost under the same semantics". Stop condition: the performance target can only
be met by deleting checks, relaxing freshness or changing semantics. T5 therefore measures **the full v9 semantics** (per-hop revocation of certificates and
keys, registered root, budget note, compressed accountability, gate obligations) and never a reduced circuit.

Pre-registered engineering targets (research design line 300, D = 4, h = 20; reported pass / fail, **not moved after the run**):
- T-lat: p95 of the **local authorization computation** ≤ 10 s;
- T-mem: peak RSS ≤ 8 GiB;
- T-gas: controlled **verifier-only** gas ≤ 500k. The full transaction cost is reported separately.

## World (shared by E4a and E4b; built once, not timed except where stated)
- 32 humans (Semaphore group, depth 20) each register one master M_k (registration proof + `ZkDacRegistry.register` tx). D = 1 holders: 32.
- M_0 and M_1 each delegate to 8 children, each child to 8, each grandchild to 8: D = 2: 16, D = 3: 128, D = 4: 1,024.
  M_2..M_31 each delegate to 1 child: D = 2 gets 30 more (46 in total). **1,230 agents** (32 / 46 / 128 / 1,024 at D = 1 / 2 / 3 / 4).
- Every certificate with hop ≥ 1 is appended to the issued tree (depth 16); the operator calls `updateIssuedRoot` once after issuance. Revocation IMT
  (depth 20) starts with 20 decoy entries (as in E2 / E3). Note tree: on-chain LeanIMT (depth 20).
- Budget: the operator mints 10^6 units to each of M_0, M_1 and 1,000 units to M_2..M_31. Budget flows down by real `transferBudget` proofs and txs
  (each parent delegates to each child, keeping change). Every agent ends with exactly one note.
- Expiries: far in the future (≥ 10^7 s), so expiry never fires during the run. `now` of each action = the latest block timestamp, read during "fetch".
- Gate windows as in E2: revoked 30 s, note root 600 s, issued 300 s, clock skew 3600 s.
- Heights are fixed by the compiled v9 circuits (issued 16, revocation 20, registered root 20, notes 20). **No h sweep**: changing h needs a recompile and a
  new setup per height; disclosed as a limit.

## E4a — lifecycle latency, D = 1..4
Stages of one **fresh** action (new ctx nonce, new encryption randomness, the agent's current note, paths against the current on-chain state):
| stage | what is timed |
|---|---|
| S1 fetch | RPC reads of the current issued / revoked / registered / note roots and block timestamp + computing every path from the local mirror (issued paths, D cert + (D−1) key IMT non-membership witnesses, registered-root path, note path) |
| S2 assembly | ctx_hash (keccak), req_cap, budget fields (setBudget), v9 compression and encryption (toV9), state root; `stateOf` lookup by eth_call, `registerState` tx if missing (counted separately) |
| S3 witness | snarkjs `wtns.calculate` (wasm) |
| S4 prove | snarkjs `groth16.prove` (zkey read from file, the snarkjs default) |
| S5 verify | snarkjs `groth16.verify` off-chain |
| S6 submit | calldata export + `eth_sendRawTransaction` until the hash returns |
| S7 inclusion | until the receipt (anvil automine: inclusion = execution; real-chain finality is a chain parameter added analytically, not measured) |
| S8 execute | gas used from the receipt (status must be 1) |
**Local authorization computation = S1 + S2 + S3 + S4** (what the agent's machine does before submitting); T-lat applies to it.

Issuance (per delegation edge, reported separately): child key generation + parent EdDSA-Poseidon signature over the certificate (N = 30 microbenchmark),
`transferBudget` proving (from the world build, every transfer), and the gas of `updateIssuedRoot`, `registerState`, `transferBudget`, `mint`, `register`.

Design:
- **Steady state.** 3 process blocks. Each block: one node process; 1 warm-up action per D (recorded, excluded), then 10 actions per D in an order
  shuffled with seed `t5-block-<b>`. **N = 30 per D**, each a fresh action by a different agent drawn without replacement (seed `t5-agents`).
  Agents at D = 2 are drawn from the 46; D = 1 from the 32.
- **Cold start.** 10 fresh node processes per D (40 processes, order shuffled with seed `t5-cold`), one action each. Timed additionally: module import,
  wallet-state load (mirror snapshot), and the first `groth16.prove` (includes curve init). OS file cache is warm (no root access to purge it):
  "cold process, warm disk", disclosed.
- Peak RSS: `/usr/bin/time -l` per process (max resident set size) + `process.memoryUsage().rss` after each stage.
- Timeout: 120 s per action; a timeout, crash or revert is a recorded result, never dropped.

Statistics (per stage and for the local computation and the end-to-end total S1..S7):
- mean ± SD, median, p95; p99 is **not estimable with N = 30** → report the max instead.
- Bootstrap 95% CI (10^4 resamples, seed fixed) for means and for cold − steady.
- D effect: OLS slope of S4 and of the local computation on D with bootstrap CI; adjacent pairs (1–2, 2–3, 3–4) by two-sided permutation test (10^4
  permutations), Holm-corrected over the 3 comparisons; effect size = difference of means and ratio.
- Block effect: per-block means reported; a block whose mean differs from the others by > 10% is flagged (not removed).

## E4b — scale: 1,230 agents on one chain
1. **World build** (above): count and gas of every tx; transfer proving time distribution (all 1,198 transfers, one per agent at D ≥ 2).
2. **Epoch 1, concurrent actions.** Every agent builds a fresh action proof (1 unit) against **the same snapshot S0** (as if all act at once), then all
   1,230 txs go to the mempool with automine off; blocks are mined with **block gas limit 30M** until the mempool is empty.
   Reported: accepted count (expected 1,230: notes and nullifiers are disjoint), reject reasons, actions per block, number of blocks, gas per action by D,
   proof generation throughput of this machine, and whether every proof stayed inside the note-root window (drain time at 12 s per block vs 600 s).
   Actions per block for 45M and 60M limits are computed from the measured gas (stated as computed).
   State growth: note-tree leaves, budget nullifiers, `stateOf` entries, Accountability log bytes per action.
3. **Revocation at scale, rate r = 1% then 10% (cumulative)** of the 1,198 delegation edges (certificates at hop ≥ 1), sampled uniformly with seed
   `t5-revoke`. Each revocation = real `revoke_transition` proof + `ZkDacRevocations` tx by the certificate's issuer. After each rate:
   - Witness level, **all 1,230 agents**: can a non-membership witness be built, and is the v9 witness satisfiable on the new state? Expected blocked set =
     agents whose chain contains a revoked certificate (computed from the tree). Reported: **descendants not blocked (false accept)** and
     **non-descendants blocked (collateral denial)**; expected 0 and 0.
   - Real txs (sample, seed `t5-revtx`): 32 descendants with proofs built **before** the revocation, submitted after the 30 s window → expected
     `StaleRevokedRoot`; 32 non-descendants with pre-revocation proofs → expected `StaleRevokedRoot` (the availability cost: every in-flight proof must be
     rebuilt once the window closes), then rebuilt on the new state → expected success.
   - Revocation proof time and tx gas vs IMT size; re-proof count.

## Not in T5 (with reason)
- Concurrency races and budget conservation: done in E2 (#39, `../../t5_e2/E2-budget_20261009`); issue #7's item "并发/预算守恒" is closed by E2.
- Fan-out / Δ / committee-size sweeps of research design line 215 beyond the above: E3 (Δ, revocation position) and E6 (committee 3-of-5) cover them;
  fan-out is fixed at 8 (main working point).
- D = 8 / 16: not compiled; the circuit size is linear in D (≈ 45k constraints per hop, v9 RESULTS), so the slope is reported instead.

## Evidence
Scripts and raw outputs in this directory; every number in RESULTS.md cites a file under `results/`. Failed or partial runs are kept and renamed, not
deleted.
