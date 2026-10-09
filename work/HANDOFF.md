# 乙方实验工作交接（2026-10-09）

写给接手的 agent。读完本文件，再读 `work/EVIDENCE_PROTOCOL.md` 和 issue #1、#11，就可以开工。

## 0. 背景与角色
- 论文：ZK-DAC / ZK-HADA（`paper.tex`，目标 WWW 2027），在只读历史仓库 `ttwang-szu/ZK-HADA @ 7966d60`。
- 用户是**乙方**：负责协议设计、全部代码、全部实验和实验章节。甲方负责论文写作与安全分析。权重 / 作者顺序不归我们讨论。
- 本仓库 `Winston-9527/zk-hada-exp`（私有），默认分支 **`main`**。总览 issue #1，子任务 T0–T9 = #2–#11。
- 用户用中文交流，回复用中文；数字、结论要有证据路径。

## 1. 协作规则（必须遵守）
1. **认领**：在 issue 下评论 + 加 `agent-claimed` 标签；一个任务一个分支；通过 PR 合并，**合并必须等用户明确批准**。
2. **证据**：新实验放新目录（`work/t2_circuit_fix/zkdac_vN`、`work/t3_attacks/vN` …），**不覆盖已有证据**；更正以追加方式写，保留 `_run1` 等原始输出。
3. **预注册**：T3 攻击映射（`ATTACKS_PREREGISTRATION_vN.md`）**先提交并 push，再跑攻击**。结果与预注册不一致时，原始数据不改类，在 `RESULTS_vN.md` 写"与预注册的偏差"。
4. **测试通过 ≠ 安全证明**。任何非 POLICY 的 FALSE_ACCEPT 都意味着对应声称 FAIL。
5. **本机运行**：重任务在本机（Apple M5 Pro, 15 核）跑。**不要用 `ssh 201`**（那不是用户的机器，CLAUDE.md 的说法对本用户不适用）。
6. **路径**：本地克隆在 `<ZK-HADA worktree>/.exp/zk-hada-exp`。会话 scratchpad（/private/tmp/...）会被清空，不要把克隆或长任务放那里。
7. **大文件**：`.zkey`、`.ptau` 不进 git，只提交 `MANIFEST.sha256`；proving material 发 GitHub release，上传后**重新下载核对哈希**。
8. 另有一个本地会话负责 T1（`work/t1/`），可用 SendMessage 协调；`work/t1_recovery/` 是本线的 T1 工作。
9. 关闭 issue 前逐项核对勾选项是否真的完成（曾经误关 #17，见 #28）。

## 2. 当前状态
### 电路版本线（全部保留，新版本 = 新目录）
| 版本 | 目录 | 内容 | 状态 |
|---|---|---|---|
| v2 | `zkdac_v2` | 修复开关漏洞、nullifier 绑定持有者密钥 | 存档 |
| v3 | `zkdac_v3` | 公开输入布局 C（合约算 ctx_hash） | 存档 |
| v4 | `zkdac_v4` | 撤销改为有序 Merkle 树（IMT，深度 20） | 存档 |
| v5 | `zkdac_v5` | 已注册根证书树（注册合约维护，R1/R2） | 存档，2^17 开发 ptau |
| v6 | `zkdac_v6` | + 持有者密钥撤销（查 ent[2..D]） | **main 上的主电路**，Hermez 2^18 |
| v7 | `zkdac_v7` | + R6 问责（加密 ent[0..D]，方案 A / C） | **PR #31 待批准**，推荐方案 C |

### 关键数字（D=4，Apple M5 Pro，snarkjs 0.7.6）
| | 约束 | 公开输入 | verifyProof gas | execute gas | 证明时间 |
|---|---|---|---|---|---|
| v6 | 169,300 | 7 | 236,395 | 318,707 | 2.29 s |
| v7 A | 201,140 | 29 | 378,216 | 482,508 | 2.54 s |
| v7 C | 181,728 | 23 | 338,316 | 438,574 | 2.45 s |
注意：v7 的 D=3 也超过 2^17（C：136,838），D=3 证明时间从 1.46 s 跳到约 2.1 s。gas 用 forge（cancun）测量，不含 intrinsic 和 calldata。

### 未合并 / 未完成的东西
- **PR #31（#30，v7）**：等用户批准。合并后在 main 上复测：`forge test`（应 125/125）、`node scripts/smoke.mjs`（zkdac_v7）。
- **release `v7-proving-material-20261008`**：首次上传因网络超时中断，只传上 a1/c1/c2；交接时正在后台重传 a2/a3/a4/c3/c4 和 MANIFEST。接手后先 `gh release view v7-proving-material-20261008 --json assets` 检查，缺的用 `gh release upload ... --clobber` 补，再全部下载核对 `zk/MANIFEST.sha256`。zkey 本地在 `work/t2_circuit_fix/zkdac_v7/build/zk/`。
- 已有 release（均已核对哈希）：`archive-pre-v3-20261007`、`v4-proving-material-20261008`、`v5-registration-proving-material-20261008`、`v6-proving-material-20261008`。
- ptau：`work/ptau/hermez/powersOfTau28_hez_final_18.ptau`（不在 git 里；来源 circom.info，blake2b 与 snarkjs README 一致，已完整 verify；见该目录 README）。若本地丢失，从同一链接下载并核对 `EXPECTED_BLAKE2B.txt`。

## 3. 用户已做的决定（不要重新讨论）
- 主线 **H1 + H2**；H3（预算守恒）不放弃，先做限时的"100 单位兄弟预算实验"再决定（#11）。
- 撤销：持有者密钥粒度，检查 ent[2..D]；主代理由"重新注册 = 替换 + 自动撤销"处理；撤销用 IMT 深度 20；密钥条目 `H("zkrk", Ax, Ay)` 与证书条目共用同一棵树。
- 第二个 nullifier 只在注册证明里；人类密钥 = ent[0] 私钥 = Semaphore 身份；根证书树由注册合约链上维护（方案 b），cert0 不加 salt。
- 根新鲜度、时钟、重放是合约义务（#18），论文写成"电路 + 合约"联合声称。
- 保留 32 位能力位子集；预算上限 / 时间范围在 #16 讨论（**未定**）。
- ptau 用 Hermez 2^18；第二阶段只有一次本地贡献，不是可信设置，要如实写。
- R6 进电路，加密 ent[0..D] 全部（#30）。方案 C 是推荐，**用户尚未明确拍板 C vs A**——合并 #31 时顺便确认。

## 4. 待办任务（按优先级）
### P0
1. **跟进 PR #31 合并**与 v7 release 完整性（见上节）。确认主电路用方案 C 后，在 #11 更新清单里的数字（约束 / 公开输入 / gas / 时间）。

### P1
2. **E6 门限问责打开**（#30、#6）。目前审计端用单一私钥 `tsk`。要做：
   - 委员会私钥 Shamir t-of-n 分享（如 3-of-5），**不重构私钥**：每个成员给出部分解密 `s_i·c1` 和 Chaum-Pedersen (DLEQ) 正确性证明，组合方用拉格朗日系数在群上合成 `tsk·c1`。
   - 实验：t-1 / t / t+1 份额；重复份额；错误份额（DLEQ 应拒绝）；key epoch 混用；篡改密文（链上已由证明绑定）。
   - research design 第 323 行：如果只能靠重构完整私钥演示，就只能写"集中式 opening"，不能宣称鲁棒分布式门限追责。
   - 部署检查：TPK 必须是素数阶子群点且不是单位元（T3 A19i）；考虑在部署脚本里检查。
   - 匿名性：同一条链两次动作的密文不可关联（统计检验或论证）。
3. **H2 专门实验（E3，#6）**：
   - 兄弟分支在撤销后仍可用；
   - 撤销更新成本随后代数量（预期常数：插入 1 条）；
   - **其他持有者的见证重建成本**：每次 IMT 插入都会改变路径，测"一次插入后需要刷新见证的持有者比例与耗时"；
   - 撤销条目公开后的观察泄露（谁能把撤销条目和已见过的证书/密钥对上）；
   - 接受窗口 Δ 与撤销生效延迟（合约已有窗口，测量曲线）。
4. **#18 合约义务补完**：
   - 密钥撤销条目的提交权限（建议：持有者用该密钥签名自撤；上级只能撤自己签发的证书）——目前撤销根由运营方 `updateRoots` 设置；
   - 回滚后重提交、重入测试；
   - gas 分解（verifier / 存储 / calldata / 业务调用）；
   - **真实交易收据**（anvil / geth；mainnet-fork 或测试网）——v5 之后都没测过。gas 要写明客户端和硬分叉（见 #11）。

### P2
5. **H3 预研**（#11、#16）：先构造"逐跳限权导致兄弟超额分配"的反例，再做最小 note 方案测成本；有结果后与用户讨论标题与 #16 方案。设时限，不要无限展开。
6. **T5 端到端与规模（#7）**：生命周期延迟分解（签发、取路径、witness、证明、验证、提交、执行；冷启动 / 稳态分开）、D=1..4 曲线、N ≥ 30 每次新实例、均值 ± SD 和检验、10³ 智能体模拟。可选优化：把 v7 C 的 D=3 压回 2^17 以内（超出 5,766 约束）。
7. **T6 公平基线（#8）**：zk-creds / UCAN / ZK-ACE 官方实现，缺失功能记 N/A；同栈自实现对照表；写入 RQ114 负结果（基线源码可得性假设被证伪）。
8. **T7（#9）**：审查 `TANON.lean` / `TNFF.lean`（游戏胜率写成常数、`PMF.pure false`、`sorry`/公理），列出 axioms；整理"假设—定理—实现"对应材料交甲方。
9. **T8（#10）**：实验章节、图表、复现包、独立环境 clean build。依赖以上各项。
10. **#11**：等甲方回复对齐清单；不要替甲方改 `paper.tex`。T1（#3）剩余项属于另一个会话。

## 5. 怎么跑
```bash
cd <ZK-HADA worktree>/.exp/zk-hada-exp/work/t2_circuit_fix/zkdac_v7     # 或 zkdac_v6
npm ci
# 编译（mode a / c，D = 1..4）
circom circuits/main_c_d4.circom --r1cs --wasm --sym -l node_modules -l node_modules/circomlib/circuits -l node_modules/@zk-kit/binary-merkle-root.circom/src -o build/c4
node scripts/smoke.mjs                         # 有效实例 + 审计端解密
node scripts/mutate_v7.mjs 4 C                 # T2
./scripts/setup_zkeys.sh                       # zkey（Hermez 2^18）
node scripts/check_public_binding.mjs          # 公开输入证明层绑定
MODE=C node scripts/prove_bench.mjs 10         # 基准
cd ../../t3_attacks && node v7/attacks_v7.mjs  # T3（先提交预注册！）
cd ../t4_contracts && node gen_fixtures_v7.mjs && cd foundry && forge test
```
每个目录的 `RUN_RECORD.md` 有完整命令与环境。forge 依赖：forge-std v1.17.0；`ln -sfn ../../node_modules/@zk-kit/lean-imt.sol foundry/lib/zk-kit-lean-imt`（见 `t4_contracts/RUN_RECORD_v5.md`）。

## 6. 踩过的坑
- **v2 生成器的 `extraLeaves` / `issuedExtra`** 下标 ≥ 2^16，叶子根本不在 issued 树里（oracle 却当作已登记）。需要真实成员时传 `extraLeafBase: 40000`。默认值不能改（会破坏历史实例的逐字节一致）。
- **实例的主代理密钥由带 D 的种子派生**：不同 D 的链 cert0 不同，合约夹具要为每个 D 注册不同的人。
- **`meta.ents`** 存的是实体对象（含 prv、sk），不要覆盖（v7 曾因此中断）。
- **circom 公开信号顺序 = 模板里的声明顺序**，不是 `public [...]` 列表顺序。合约组装公开输入前，用 `check_public_binding.mjs` 核对。
- **BabyJub 子群阶 l ≈ 2^250.6 < 2^251**：`Num2Bits(251)` 不保证 r < l。需要规范标量时加 `LessThan` 比较（holder_sk 已这样做）。
- circom 条件分支里同名 component 类型不同会报 T2056，要用不同名字。
- LeanIMT 填充位兄弟节点、D=1 时的 issued_root 在见证层可变，但声称不变（D=1 的 issued_root 已在证明层绑定）。这在每次 T2 都会出现，属正常。
- **基准脚本会把 `sample_proof_*.json` 写进该版本的 `results/`**：重跑旧版本基准时不要直接跑旧脚本，改输出路径到 scratchpad。
- forge gas：每个配置单独一个 test，从同样的初始状态测；`vm.prank` 只作用于下一次调用（中间的 view 调用也会消耗它）。
- macOS 的 bash 是 3.2：不支持 `${x^^}`；`$UD$D` 会被当成变量 `UD`，要写 `${U}D`。
- Hermez 官方 ptau 镜像（S3 / GCS）返回 403，用 snarkjs README 的 circom.info 链接。
- `gh release create/upload` 大文件容易超时，上传后一定重新下载核对哈希。
- PR 的 base 是 `main`（不是 master）。

## 7. 披露惯例
每个 `RESULTS_vN.md` / `RUN_RECORD.md` 都有"透明披露"或"偏差"一节：脚本错误、预注册错误、run1 与修正后结果的差异，全部写明并保留原始文件。向用户汇报时，也要主动说明自己之前说错的地方（例如 #28 的消融更正了"证书撤销拦不住泄露密钥"的说法）。
