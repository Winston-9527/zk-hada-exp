# Run record: T8b / E7c / E6c (second environment)

## First environment, before the second-environment run (development smoke only, NOT evidence; outputs deleted before the code commit)
- 2026-10-13, Apple M5 Pro: v9.1 rebuilt from the frozen tag, byte-identical to the build behind the released keys (D = 1..4 r1cs and wasm) -> `repro/expected_build_v91.sha256`.
- `cross/mac_proofs_d*.json`: 10 proofs per D made on the Mac (`node cross/gen.mjs D 10 mac`), 40/40 verify on the Mac (these are evidence for C6a).
- E7c smoke: `gen_batch_v91.mjs` N = 2, then N = 30 (8 min 42 s); `forge test --match-path test/V91*.t.sol`. Found and fixed before any second-environment run:
  reading the whole batch fixture for every item copies it into EVM memory each time (MemoryOOG in B3) -> one small JSON file per item. After the fix:
  N = 2: 73/73 tests (V91, V91Policy, V91Batch*); N = 30: V91Batch* 28/28.
- E6c smoke: fixtures N = 3 per (committee, D), N = 1 for (3, 5) epoch 2; cases 256 rows, 0 not as pre-registered (O20 on the N = 30 batch fixture,
  O21 on the three off-curve rows); about 1 h on the Mac, dominated by O2 for (5, 9).

## Second environment
Host `enine` (ssh alias RTX6000), Ubuntu 22.04.5, x86_64, 40 cores. Toolchain installed in user space under `~/projects/zkhada-tools` on 2026-10-13:
| file | source | sha256 |
|---|---|---|
| node-v24.14.1-linux-x64.tar.xz | nodejs.org (checked against SHASUMS256.txt: OK) | 84d38715d449447117d05c3e71acd78daa49d5b1bfa8aacf610303920c3322be |
| circom (circom-linux-amd64 v2.2.3) | github.com/iden3/circom release v2.2.3 | 85342c7ff332d948df7c0c50ecf201e6129349aef550ce873f3c811b79fe53a3 |
| foundry_v1.5.1_linux_amd64.tar.gz | github.com/foundry-rs/foundry release v1.5.1 | 73640b01bd9ed29fdb4965085099371f8cf0dbbec3e2086cf54564efc4dcfe88 |

### Runs (each a fresh clone of the public repository into `~/projects/zk-hada-exp`, empty npm cache)
```bash
. ~/projects/zkhada-tools/env.sh; export NPM_CACHE=$HOME/projects/zkhada-npm-cache-attempt<n>
bash work/t8_paper/T8b-v91-repro_20261013/repro/run_env2.sh > ~/projects/run_env2_attempt<n>.log 2>&1
```
| attempt | commit | UTC | outcome |
|---|---|---|---|
| 1 | f6364e0 | 06:05–06:14 | stopped in 20_fetch (ptau download; network) after C0, C1, C2 ok |
| 2 | 3c668d1 | 06:14–06:15 | stopped in 10_build (npm ECONNRESET) |
| 3 | f441c56 | 06:45–08:35 | complete: T8b 00–30 by 07:08, E7c 07:08–07:17 (fixtures 34 s + 488 s), 40–60 by 07:30, E6c 07:30–08:35 (fixtures 449 s, cases 3,468 s); `run_env2 done` |

Copied back with scp / tar and checked against sha256 lists made on the server: `attempts/<n>/`, E7c `results/` and fixtures (`results/fixtures.sha256`), E6c `results/`.
C6b: `node cross/verify.mjs attempts/3/cross/env2_proofs_d*.json` on the Mac -> `attempts/3/C6b_on_mac.txt`.
Extra (not pre-registered): the V91 forge suites on the Mac with the second-environment fixtures -> E7c `results/forge_v91_on_mac_with_env2_fixtures.txt` (73 / 73).
