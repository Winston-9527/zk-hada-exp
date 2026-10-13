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
Commands and times of the run: appended below after the run.
