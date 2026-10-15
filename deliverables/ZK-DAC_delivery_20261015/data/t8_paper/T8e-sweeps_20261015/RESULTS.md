# T8e — WP14 residual sweeps: results

- **Pre-registration:** `PREREGISTRATION.md` (2df2c73). Amendment A1 (fea941b): S2 reduced, by user decision.
- **Machine:** all timings on the Mac M5 Pro with no other project computation. Constraints, sizes and gas do not depend on the machine.
- **No timeout or OOM occurred in any step.** Peak RSS of a compile was ≤ 1.8 GB; of a run, ≤ 4.5 GB.

## S1 — tree height h (all four Merkle structures at depth h)
v9.2 uses (MD, RD, RT, NT) = (16, 20, 20, 20). Here all four structures are set to h. The template is unchanged. The ptau is 2^18, which covers every variant. Benchmark: 10 fresh instances per run, 2 runs; every proof verifies (120 / 120).

| D | h | constraints | zkey (MB) | setup (s) | prove ms run 1 / run 2 | witness ms (mean) | capacity per structure |
|---|---|---|---|---|---|---|---|
| 2 | 10 | 76,234 | 39 | 13 | 1,287 / 1,297 | 161 | 2^10 = 1,024 |
| 2 | 20 | 107,514 | 50 | 16 | 1,540 / 1,608 | 170 | 2^20 = 1,048,576 |
| 2 | 24 | 120,026 | 55 | 16 | 1,713 / 1,647 | 185 | 2^24 = 16,777,216 |
| 4 | 10 | 138,804 | 72 | 20 | 2,572 / 2,321 | 220 | 2^10 = 1,024 |
| 4 | 20 | 201,284 | 94 | 29 | 3,036 / 2,815 | 253 | 2^20 = 1,048,576 |
| 4 | 24 | 226,276 | 103 | 32 | 3,232 / 2,982 | 262 | 2^24 = 16,777,216 |

- **Constraints grow by ≈ 3.1k per unit of h at D = 2, and ≈ 6.2k at D = 4.** Every Merkle path in the statement grows; D = 4 has more paths.
- **Proving grows by ≈ 30 % from h = 10 to h = 24:**
  - D = 2: 1.29 s → about 1.68 s;
  - D = 4: about 2.45 s → about 3.1 s.
  - At D = 4 the two runs differ by up to 250 ms, more than at D = 2, so the means carry about ±5 %.
- **Capacity:** h = 10 caps every structure at 1,024 entries, too small for the note tree of any realistic deployment (the note tree grows by one leaf per action). h = 20–24 gives 10^6–10^7.
- **Verifier gas** does not depend on h, because the public inputs are the same (18 at D = 2, 20 at D = 4). This follows from the verifier's structure: the number of public inputs fixes its work. It was not re-measured on chain per h.
- **Deviation:** the pre-registration said to confirm the verifier gas once per D with a real call. That was not done; the statement above rests on the unchanged public-input count. E7d and T5c I3 measured the v9.2 verifier gas at the default heights.

## S2 — depth D = 8 (scaling variant; amendment A1)
- **Variant `s2/circuits/zkdac_chain_v9_d8.circom`:** the note lineage is widened to max(4, D), so the note is Poseidon(4 + L). The diff against v9.2 shows only those lines. **This changes the note format for D > 4.**

| circuit | constraints | public inputs | private inputs |
|---|---|---|---|
| variant, D = 8 | **375,148** | **24** | 1,014 |
| variant, D = 4 (control) | 195,044 | 20 | 514 |
| v9.2, D = 4 (reference) | 195,044 | 20 | — |

- The D = 4 control equals v9.2 exactly. Widening the lineage costs nothing up to D = 4.
- D = 8 needs about 375k constraints, which is 1.92 × D = 4 and above the 2^18 ptau. The increment per hop from D = 4 to 8 is ≈ 45k constraints, as for D = 1..4.
- No setup, proving time or gas is reported for D = 8. A 2^19 ptau would be needed, and the user decided against it.

## S3 — number of agents N
- **World:** 8-ary trees of depth 4 under masters, with the first N nodes in DFS pre-order.
- **Chain:** real v9.2 action verifiers; accept-all budget mint and registration verifiers, used only to fill the trees.
- **Actions:** 10 real actions per N, stratified by depth.
- **All 40 actions were accepted, and all 40 proofs verify off-chain.**

| N | agents D = 1 / 2 / 3 / 4 | credential build (8 workers) | chain setup | client mirror: size / rebuild | path fetch (S2) | witness assembly (S3) | proving D = 1 / 2 / 3 / 4 (ms) | execute gas (min–max) |
|---|---|---|---|---|---|---|---|---|
| 32 | 1 / 1 / 4 / 26 | (cached from the smoke run) | 0.4 s | 8.4 kB / 34 ms | 0.3–0.7 ms | 24 ms | 854 / 1,455 / 2,380 / 2,768 | 556,626–634,050 |
| 128 | 1 / 2 / 14 / 111 | 7.5 s (445 ms per credential) | 1.2 s | 24 kB / 136 ms | 0.3–0.7 ms | 24 ms | 851 / 1,440 / 2,357 / 2,633 | 566,950–644,386 |
| 1,024 | 2 / 14 / 112 / 896 | 54 s (414 ms) | 9.5 s | 166 kB / 1.2 s | 0.3–0.6 ms | 24 ms | 835 / 1,466 / 2,379 / 2,605 | 582,424–659,872 |
| **10,000** | 18 / 137 / 1,094 / 8,751 | **568 s** (453 ms) | 86 s | **1.6 MB / 13.2 s** | 0.3–3.4 ms | 24 ms | 895 / 1,509 / 2,456 / 2,772 | **706,232–783,677** |

- **Proving does not depend on N:** within ±5 % at every D. The client-side path fetch stays in milliseconds.
- **What grows with N:**
  - the one-time costs: credential issuance, ≈ 0.45 s per credential, plus the chain setup;
  - the client mirror: rebuilding the trees from 1.6 MB takes 13 s at N = 10,000;
  - the execute gas, through the note-tree index.
- **Gas model** (`s3/results/gas_fit.txt`; 36 actions, excluding each run's first):
  **gas = 463,747 + 27,080 · popcount(index) + 7,753 · D + 5,162 · bit_length(index)**, R² = 1.0, max residual 32 gas.
  - The popcount and D coefficients reproduce T5 (27,089 and 7,763).
  - The bit-length term is new. T5's narrow index range could not separate it: every doubling of the note tree adds one LeanIMT level, ≈ 5.2k gas.
  - Each run's first action costs 43–75k more. It pays the cold storage writes of the target and of the gate's counters, the same effect as T5c I3's attempt 1.
- At N = 10,000 (note index ≈ 10^4), an execute costs 706–784k gas. At the tree's capacity of 2^20, the model gives about 0.87 M on average (popcount ≈ 10, bit length 20, D = 4).

## Deviations
- S2 was reduced (amendment A1).
- S1's verifier-gas confirmation was not run on chain (see S1).
- N = 32 reused the credentials cached in its smoke run, so its credential-build time is not reported. The credentials are deterministic.

## Corrections after audits #80 and #81 (2026-10-15; no new experiment)
- **S2 is compiled only.** No satisfying witness was ever generated for D = 8, so completeness is not tested.
- **Amendment A1's header time (08:15Z) is later than its push** (fea941b, committed 08:08:27Z, pushed with `r1cs_info.txt`).
- **S3 gas model: exploratory and post hoc.** The pre-registration specified neither the model nor the exclusion rule.
  - Sequence: `gas ~ popcount + D` (R² 0.977) was fitted first; then the bit length was added and each run's first action excluded (R² = 1.0; audit: 0.99999995). Including the first actions gives R² 0.957.
  - **bit_length takes only 4 values {6, 8, 11, 14}, one per N**, so it is confounded with N (VIF ≤ 2.7, not collinear).
  - **The 0.87M at 2^20 is an extrapolation.**
- **First-action excess.** Under the final model it is **34–54k, not 43–75k** (that range was the residual of the earlier model). The attribution "the target and the gate's counters" was wrong: `ZkDacGateV9.execute` has no counters. The target's first writes (`total`, `calls`) account for ≈ 34.2k; at N ≤ 1,024 about 20k remain unexplained.
- **S3 mock list (corrected):** the registration and revocation verifiers were accept-all too, contrary to the pre-registration's "as in T5" (T5 used the real registration verifier). The transfer and mint verifiers were accept-all, and transfer was never called.
  - This is not listed as a deviation above. "Chain setup 86 s" excludes registration and mint proofs, so it understates the one-time cost.
- **"Otherwise idle" means "no other project process".** Load averages were 9.4–13 during S1 and 6.8–14.2 during S3 (15 cores). The ≈ 10 % gap between S1's D = 4 runs may be partly load.
