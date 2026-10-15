# T3 on v9.2 (zkdac_v9_2/PREREGISTRATION.md check 6): results
`attacks_v9_2.mjs` and `exhaustive_diff_v9_2.mjs` are the v9.1 scripts with imports and build paths changed to zkdac_v9_2; nothing else changed. 2026-10-13, local.
- Summary identical to v9.1: AGREE_ACCEPT 28, AGREE_REJECT 118, BAD_WITNESS_ONLY 7, FALSE_ACCEPT 21 (the POLICY rows closed by the gate, as on v9.1).
- Every row's (id, name, D, class) is identical to v9.1.
- 27 failure locations differ, and all of them are the same template with the line shifted: +1 after the inserted header comment, +4 after the 3 inserted lines of the new constraint (ZkDacChainV9 +1 ×7 and +4 ×11, MerkleMember +1 ×5, LeqU64 +1 ×2, CapSubset +1 ×2).
- Exhaustive diff D = 4: total 534, agree 89, and the same 3 statement-level rows (now, act_req_cap, ctx_hash: circuit accepts, oracle rejects; closed by the gate) as v9.1.
- The F-2 rows were run in zkdac_v9_2/scripts/f2_poc.mjs and E7d instead of as T3 rows A25a–d (see zkdac_v9_2/RESULTS.md, deviations).

Commands: `node v9_2/attacks_v9_2.mjs > v9_2/results/attacks_v9_2.json 2> v9_2/results/attacks_v9_2.stderr; node v9_2/exhaustive_diff_v9_2.mjs 4 > v9_2/results/exhaustive_diff_v9_2_d4.json 2> v9_2/results/exhaustive_diff_v9_2_d4.stderr`
