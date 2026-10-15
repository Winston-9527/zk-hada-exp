# ZK-DAC 实验仓库审计引导

本文写给核验实验结果的审计师。读完后，你应该知道：
- 论文在哪里；
- 实验是怎么设计的；
- 电路经历了哪些版本，各版本的结果是什么；
- 当前（v9）的每项结果放在哪里，以及怎样独立核验它。

所有路径都相对于本仓库根目录。仓库基线：`main` @ `bfd1f22`（2026-10-11）。

**2026-10-12 修订（审计 #53–#59）**：修复与更正在分支 `audit-fixes-20261012`（未合并前不在基线中）。主要变化：
- 主电路升级为 **v9.1**，修复中间密钥不在曲线上的问题（#53）；
- E6b 判据重做为 E6b2（#54）；
- 补全 v9 门上的 POLICY 闭合测试（#55）；
- 补做 T5b 与 T6b（#56–#58）；
- 本文的错误按 #59 逐条更正。

各 RESULTS 文件的更正一律追加在文末，原文不改。

---

## 1. 范围

**审计对象**是乙方的实验工作：电路、合约、实验脚本、原始输出、统计分析、复现包。

**不在范围内的**：
- 论文正文和安全证明的写作，这是甲方的工作；
- 历史仓库本身的正确性。历史仓库只作为对照，其中的问题已在本文第 5 节（版本表 RQ108 行）说明。

**一条贯穿全文的原则**：实验通过只表示实现与所述关系在被测集合上一致，**不是安全证明**。我们没有把任何实验结果表述为安全证明，见第 8 节。

## 2. 论文与相关文件在哪里

| 对象 | 位置 | 说明 |
|---|---|---|
| 论文现稿 | 历史仓库 `ttwang-szu/ZK-HADA` @ `7966d60`，文件 `paper.tex` | 只读。**旧数字（46,593 约束、1.51 s、235,891 gas 等）来自旧电路，已作废**，出现在摘要、第 51 行、贡献列表第 143 行、第 164 行的表和第 6 节；原因见 `work/t1/CLAIM_EVIDENCE_MAP.md` |
| 研究设计 | 同一历史仓库：`docs/research/proposals/2026-09-19_RESEARCH_DESIGN.md` | 假设 H1–H5、可证伪猜想 Q1–Q6、实验 E0–E8、统计要求（第 7 节）、止损条件（第 315–323 行）。下文行号都指这个文件 |
| 新实验章节 | `work/t8_paper/T8-chapter_20261010/experiments.tex`、`appendix_repro.tex`、`figures/` | 乙方交付，**尚未并入 paper.tex**（由甲方整合）。章节中的每个数字都是宏，由 `make_numbers.py` 从结果文件生成，台账见 `CLAIM_LEDGER.md`。章节写于 E6b 之前，第 134 行“anonymity … was not tested empirically”与 E6b 矛盾，修订见 `audit-fixes-20261012` |
| 阶段报告 | `work/reports/STAGE_REPORT_20261011.md`，在**未合并的** PR #51（分支 `report-stage-20261011`）上，不在基线 `bfd1f22` 中；网页版 https://claude.ai/artifact/RRuDMEMr116tGy1JBCwPjD | 逐项对照研究设计的进度。网页需分享后才能打开 |
| 论文对齐清单 | issue #11（52 项） | 实验结果与论文现稿的全部差异，等甲方处理 |
| 证据规则 | `work/EVIDENCE_PROTOCOL.md` | 见第 3 节 |
| 证明密钥 | GitHub release `v9-proving-material-20261010`（v9）；v4–v7 各有 release（v7 的 `v7-proving-material-20261008` 原为 Draft，2026-10-12 已发布）；v9.1 的 zkey 尚未上传 release，只提交了 vk 和哈希（`work/t2_circuit_fix/zkdac_v9_1/zk/MANIFEST.sha256`） | zkey 不进 git，只提交哈希 |

## 3. 证据规则（审计时可以逐条检查）

1. **先预注册，再运行。** 每个实验先提交并推送预注册文件，内容是攻击清单、用例、统计方法和判定规则，之后才运行。结果与预注册不符时，原始数据不改分类，在 RESULTS 的"偏差"一节说明。
2. **新实验放新目录，不覆盖旧证据。** 失败或作废的运行保留为 `*_run1*`、`*_oldoracle*` 等文件。
3. **每个运行目录都有：**
   - `RUN_RECORD.md`：命令原文、环境、种子；
   - `MANIFEST.sha256`：输入和输出的哈希；
   - `RESULTS.md`：结果、偏差、局限。
4. **POLICY 行。** 有些攻击的语句在电路层面成立，但应由合约拒绝，例如重放、上下文替换、过期根、伪造时钟。这类行在预注册时就标为 POLICY，每行都需要有合约测试闭合它。闭合测试的清单：v7 门在 `work/t4_obligations/E7-obligations_20261009/POLICY_CLOSURE.md`；v9/v9.1 门在 `work/t4_obligations/E7b-v9-policy-closure_20261012/POLICY_CLOSURE_V9.md`（`V9Policy.t.sol`，补于审计 #55 之后）。**更正**：本文原写 v9 的闭合在 `V9.t.sol`，实际它只闭合了 20 行中的 8 行。
5. **FALSE_ACCEPT 判定。** 凡不属于 POLICY 的 FALSE_ACCEPT（电路接受、oracle 拒绝），都判定对应声称失败。

## 4. 实验设计：研究设计 → 实验 → 目录

| 研究设计中的问题 | 实验 | 目录 | 预注册提交 |
|---|---|---|---|
| E0 历史结果能否复现 | 恢复历史电路，逐条核对论文数字 | `work/t1/`、`work/t1_recovery/` | — |
| Q1 可接受动作 ↔ 唯一授权链与上下文（H1） | T2 单字段变异；T3 差分攻击（独立 oracle） | `work/t2_circuit_fix/zkdac_v*/`、`work/t3_attacks/` | T3 各版本：`work/t3_attacks/v*/ATTACKS_PREREGISTRATION_v*.md`；v8/v9/v9.1 电路：各目录 `PREREGISTRATION.md`。**T2 v2–v7 没有预注册文件** |
| Q2 授权守恒（H3） | H3 预研；E2 并发预算竞争（真实交易） | `work/h3_prestudy/`、`work/t5_e2/E2-budget_20261009/` | `0d00fdf`；`9ca27ec`（§E2） |
| Q3 撤销后后代不可行动、兄弟可用（H2） | E3 撤销与新鲜度；T5 规模化撤销 | `work/t4_revocation/E3-revocation_20261009/`、`work/t5_e2e/` | `907c23b`；`1d939e2` |
| Q4 谱系不可区分 | E6 U1/U2（密文）；E6b v9 transcript 可链接性；E6b2 判据重做（事后修正 A2） | `work/t4_accountability/E6-*`、`work/t4_privacy/E6b-*`、`work/t4_privacy/E6b2-*` | `08dbb16`；`b8a71c1`（修正 A1 在 `cbe5594`，与数据同一提交）；E6b2 `59c05f5` |
| Q5 opening 与责任密钥一致（H4） | E6 门限打开；T3 A19/A22/A24；v9.1 曲线检查 | `work/t4_accountability/E6-threshold-opening_20261009/`、`work/t2_circuit_fix/zkdac_v9_1/` | `08dbb16`；v9.1 `8b82adf` |
| Q6 同语义下的性能 | E4/T5 生命周期与规模；E7 合约义务与真实收据；T6 公平基线 | `work/t5_e2e/`、`work/t4_obligations/E7-*`、`work/t6_baselines/` | `1d939e2`；`d22546b`；`fb8dd96` |
| 机检与证明材料 | T7 Lean 审查；T7b Lean 状态机不变量 | `work/t7_proofs/` | `f26270e`；`24eadcc` |
| E8 复现 | T8 章节、数字台账、clean build | `work/t8_paper/T8-chapter_20261010/` | `f5675a9` |

## 5. 电路版本线与各版本结果

历史电路可以被绕过（第 1 行），所以按研究设计第 318 行的止损规则，我们从可信的最小关系重建，每个新版本放在新目录：`work/t2_circuit_fix/zkdac_vN/`。
- 约束数取 D=4 的主配置。v2–v4 的数字见各自的 `results/constraints_ablation.csv`，v5 见 `RUN_RECORD.md`，v6–v9 用 `snarkjs r1cs info` 读取。
- T3 一栏的格式是：总行数 / 非 POLICY 的 FALSE_ACCEPT（含预注册漏标 POLICY、未改分类的行）/ 完备性缺口。**更正（#59）**：原表对 v3 计入了漏标行（7），对 v7、v9 却没有计入，口径不一。下表已统一。

| 版本 | 相对上一版的改动 | 约束（D=4） | 公开输入 | T3 结果 | 状态 |
|---|---|---|---|---|---|
| RQ108（历史） | — | 46,593 | 4 | 3 个非 POLICY 误接受：检查开关可置零、nullifier 秘密可自选 | 作废，`work/t1/FINDINGS.md` |
| v2 | 去掉检查开关；nullifier 绑定持有者密钥；动作摘要在电路内计算 | 121,255 | 5 | 53 / 0 / 1（A13b：撤销树深度不够） | 存档，`work/t3_attacks/RESULTS.md` |
| v3 | 公开输入布局 C：ctx_hash 由合约计算 | 120,691 | 6 | 62 / 7（A11a，预注册漏标为 POLICY，后改由合约闭合）/ 1 | 存档，`work/t3_attacks/v3/RESULTS_v3.md` |
| v4 | 撤销改为有序 Merkle 树（IMT，深度 20） | 127,663 | 6 | 81 / 0 / 0（A13b 解决） | 存档 |
| v5 | 已注册根证书树（注册合约） | 129,850 | 7 | 87 / 0 / 0 | 存档；2^17 开发 ptau |
| v6 | 持有者密钥撤销 | 169,300 | 7 | 120 / 0 / 0 | 存档；Hermez 2^18 |
| v7 | R6 追责：加密 ent[0..D]，方案 A / C | C：181,728（A：201,140） | C：23（A：29） | 178 / 2 / 0（A19b 在方案 A、C 各 1 行，预注册漏标 POLICY，原始数据未改分类） | 存档 |
| v8 | 预算 note（H3）：花费、找零、预算 nullifier | 195,378 | 27 | 未单独做 T3，其用例并入 v9 | 存档，`work/t2_circuit_fix/zkdac_v8/RESULTS.md` |
| v9 | 去掉动作 nullifier；一个公开状态根；压缩追责密文 | 195,028 | 20 | 170 / 1 / 0（A11b-w，按设计在见证层接受）；**未覆盖曲线外密钥（#53）** | T5/T6/E6b 的测量对象 |
| **v9.1（主线）** | 对每把被加密的链上密钥做在曲线检查（BabyCheck），修复 #53 | **195,043** | **20** | **174 / 1 / 0**（新增 A24 曲线外密钥 4 行，全部在 BabyCheck 被拒；v9 上同样 4 行为误接受） | **当前主电路**，`work/t2_circuit_fix/zkdac_v9_1/RESULTS.md` |

每个版本的 RESULTS 都有"偏差"一节，记录预注册漏标、oracle 修正、harness 问题等，并保留原始运行。

## 6. 当前结果（v9 测量，v9.1 修复）及出处

T5、T6、E6b 测的是 v9。v9.1 只多 3(D+1) 个约束，公开输入不变，verifier 只差常数，所以 gas 相同。延迟差异见 `zkdac_v9_1/RESULTS.md` 的配对测量。

| 结果 | 数值 | 文件 |
|---|---|---|
| T2 单字段变异（D=1..4） | 199 / 282 / 408 / 534 个，语义用例 37 / 49 / 62 / 76，意外结果 0（“意外”以用例名中的 `EXPECT_ACCEPT` 为准，由作者标注）；v9.1 重跑，接受模式逐项相同，撤销用例改为只让目标跳过期 | `work/t2_circuit_fix/zkdac_v9{,_1}/results/mutations_d*.json` |
| T3 攻击套件 | v9：170 行，一致拒绝 114（电路见证层 95、生成器无见证 8、证明层 11）、一致接受 28、仅见证错误 7、误接受 21（20 行 POLICY + 1 行按设计）、完备性缺口 0。v9.1：174 行，新增 A24 ×4 一致拒绝；A12b′/A13 共 14 行刷新其他跳见证后，在 IMTNonMember 处被拒（v9 中被过期见证掩盖，#57） | `work/t3_attacks/v9/results/attacks_v9.json`、`work/t3_attacks/v9_1/results/attacks_v9_1.json` |
| 穷举差分（D=4） | 534 个变异，语句层分歧 3 个（now、act_req_cap、ctx_hash，都由门合约约束） | `.../exhaustive_diff_v9_d4.json` |
| E2 并发预算 | v7 门（没有任何数量语义，**不是**逐边限额，#56）：640 被接受；v8：100/100；4 个 note 各提交 3 笔，每个 note 成功 1 笔。单发送者、固定顺序 | `work/t5_e2/E2-budget_20261009/RESULTS.md` |
| E3 撤销 | 598 行与预注册一致；其中目标拒绝 70 行及 A4/A5 来自生成器无见证，真正在电路层检验撤销的是 A3（22 个低位叶 × 7 个场景，0 接受）；消融 L 的 14/14 是构造上的必然结果，不作因果证据（#57） | `work/t4_revocation/E3-revocation_20261009/RESULTS.md`（文末更正） |
| 规模化撤销 | 撤销率 1% / 10%：无关者误挡 0 / 0（电路求值）；被挡的 301 个 agent 用前驱叶 / 自身叶见证，v9 与 v9.1 电路 **301/301 拒绝**（T5b，原 T5 的“后代误接受 0”来自生成器）；在途证明 64/64 因窗口过期被拒（与是否撤销无关），重做后 32/32 成功 | `work/t5_e2e/T5-e2e-scale_20261010/results/e4b_revoke_*.json`、`work/t5_e2e/T5b-revocation-circuit_20261012/` |
| E6 门限打开 | 65/65 与预注册一致（对抗用例只在 v7 布局上；v9.1 有诚实 3-of-5 与 2 份额检查 10/10） | `work/t4_accountability/E6-threshold-opening_20261009/results/cases.json`、`work/t2_circuit_fix/zkdac_v9_1/results/opening_check.json` |
| E6b 可链接性 | 确定性检验：0 个共享值、0 个相等密文差。分类器：**E6b 的判据判不出 LINK**（100 次置换下 Holm 最小 0.089 > 0.01），对照用的是另一把尺子（#54）；“最大 CI 下界 0.494”只针对 C1/C2。重做见 E6b2（1,000 次置换，主检验与对照同一判据，按 agent 重抽 CI）：C1/C2 在 3 个 seed × 3 个模型共 18 格中 0 格检出（Holm p = 1，最大 CI 下界 0.471）；对照 18/18 检出（Holm p = 0.006）；C3 在此规模下不可检验（最小可达 p = 0.029）；能检出的最小效应受零分布 99% 分位数限制（C1 AUC 约 0.70） | `work/t4_privacy/E6b-linkability-v9_20261010/results/`、`work/t4_privacy/E6b2-linkability-reanalysis_20261012/` |
| 延迟（T5） | 本地计算 D=1..4：0.92 / 1.55 / 2.41 / 2.74 s（每格 N=30）；D=4 p95 2.86 s，95% CI [2.75, 3.01] s；p99 无法估计（原文给的是最大值）；峰值 RSS 4.51 GiB | `work/t5_e2e/T5-e2e-scale_20261010/results/analysis.json`、`work/t5_e2e/T5b-revocation-circuit_20261012/results/latency_p95_ci.json` |
| gas | 验证器单独 315,215（D=4）；执行 gas ≈ 529,576 + 27,089·popcount + 7,763·D（R²≈1），**事后拟合**，只覆盖 note 下标 2,600–3,830（树深恒为 12）；近空树实测收据 564,147，拟合式在 popcount=0 处外推为 560,628 | 同上，以及 `gas_vs_note_index.txt`、`work/t2_circuit_fix/zkdac_v9/results/receipts_v8_v9.json` |
| 1,230 个智能体并发 | 1,230/1,230 被接受，31 个区块 | `.../e4b_epoch1.json` |
| 基线（T6） | 隐私成本：相对**明文参照门** B0（自写，不是证明过的下界），按计量口径（B0 冷/热执行、是否扣 21k intrinsic、拟合/实测 v9）为 **2.45–6.70 倍（空树）/ 3.25–8.63 倍（T5 世界规模）**，原报的 2.45–4.66 / 3.25–5.96 是下端；配对检验只改变一项判定（v8→v9 D=2 −7 ms）；官方实现 go-ucan、DAC-EQS、zk-creds 原生运行 | `work/t6_baselines/T6-baselines_20261010/results/analysis.json`、`work/t6_baselines/T6b-reanalysis_20261012/` |
| 合约 | forge 215/215（181 + v9 POLICY 闭合 34） | 全新克隆需先运行 `work/t8_paper/T8-chapter_20261010/repro/10_build.sh` 和 `40_contracts.sh`（`lib/`、`node_modules` 不在 git 中），再 `cd work/t4_contracts/foundry && forge test` |
| Lean | 历史文件：TNFF 编译失败、公理矛盾（不可引用）；新的状态机不变量 T1–T4 机检通过，无 `sorry` | `work/t7_proofs/` |

## 7. 建议的核验步骤

### A. 先验证预注册的顺序（约 1 分钟）
```bash
audit/check_prereg_order.sh
```
脚本检查每个预注册文件的首次提交，是否是该实验**最早一个输出文件**（`results/` 下的原始输出或 RESULTS）首次提交的祖先，并列出在首个输出之时或之后修改过预注册的提交（2026-10-12 按 #59 修订：原脚本只比对 RESULTS.md、有一对重复、不处理缺失文件、不检查事后修改）。2026-10-12 运行：25 项全部 OK；E6b 的预注册在 `cbe5594`（首个输出提交）中被修改，即修正 A1。

**更正**：原文说“PR 的时间线可以看出推送顺序”，这不成立。PR 时间线按提交时间排序，而提交时间可以在本地伪造。推送时间只在 GitHub Events API 中有，且只保留 90 天（`gh api repos/Winston-9527/zk-hada-exp/events`）。审计按 Events API 核对过：v3–v9、T3 v9、H3、E6、T5、T7b、T8 的推送顺序与提交顺序一致；**T3 v2（`d2fe747`→`fa73824`）没有对应的推送事件**，PR #15 在结果提交 5 秒后打开。祖先关系不等于推送顺序。

### B. clean build 与核心复现（我们实测约 15–40 分钟，取决于 ptau 的下载速度）
在全新克隆中运行 `work/t8_paper/T8-chapter_20261010/repro/` 下的 00–50 六步，详见 `work/t8_paper/T8-chapter_20261010/REPRODUCE.md`。

需要的环境：
- node 24、circom 2.2.3、forge/anvil 1.5.1、Python 3；
- 能访问本仓库 release 的 `gh`。

判据：
- C1 约束数一致；
- C2 r1cs/wasm 逐字节一致；
- C3 每个 zkey 都对其 ptau 验证通过，导出的 vk 与提交的一致；
- C4 forge 全部通过；
- C5 T3 v9 与 E6 逐行一致。

我们自己的 clean build 跑了三次。**更正**：`attempt*_*.log` 被 `T8-chapter_20261010/.gitignore` 中的 `*.log` 忽略，没有进 git；失败原因写在 `work/t8_paper/T8-chapter_20261010/RESULTS.md` 的 “Attempts” 一节。第 3 次运行中 reg20 的 C3 也失败（注册电路用开发 ptau 2^17），修正后只在同一份克隆里重跑了第 20、30 步，所以不算一次完整的干净通过；当时 C4 为 178/178。

### C. 数字台账
```bash
cd work/t8_paper/T8-chapter_20261010 && python3 make_numbers.py && git diff --stat numbers.tex CLAIM_LEDGER.md
```
- 如果没有差异，说明章节中的每个数字都能由当前结果文件重新生成。
- `CLAIM_LEDGER.md` 列出每个数字的来源文件、字段和文件哈希。

### D. 用原始数据重算统计
| 结果 | 命令 |
|---|---|
| T5 | `cd work/t5_e2e/T5-e2e-scale_20261010 && node analyze.mjs`，与 `results/analysis.json` 对照 |
| T6 | `cd work/t6_baselines/T6-baselines_20261010 && node analyze_t6.mjs` |
| E6b | `cd work/t4_privacy/E6b-linkability-v9_20261010 && python3 analyze.py deterministic`；分类器部分需要 scikit-learn 1.5.2，约 24 分钟 |
| E6b2 | `cd work/t4_privacy/E6b2-linkability-reanalysis_20261012 && ../E6b-linkability-v9_20261010/.venv/bin/python analyze2.py classify 1000`（约 3 小时）与 `analyze2.py c3` |
| T5b / T6b | `node revoke_circuit.mjs`、`node latency_ci.mjs`；`node analyze_t6b.mjs` |

T5 和 T6 的分析使用固定种子：重跑的输出应与提交的 `analysis.json` 逐字节相同。我们在 2026-10-11 对两者都核对过，结果相同。

### E. POLICY 行是否都闭合
对照 T3 v9 中 FALSE_ACCEPT 的 20 行 POLICY，逐行找到闭合它的合约测试：`work/t4_obligations/E7b-v9-policy-closure_20261012/POLICY_CLOSURE_V9.md`，测试在 `V9Policy.t.sol`（22 个来自审计 #55，1 个由乙方补写）。v7 门的闭合仍见 `POLICY_CLOSURE.md` 和 `ObligationsV7.t.sol`。

**更正**：原文让审计师在 `V9.t.sol` 中找闭合，实际只有 8 行能找到。在 `V9.t.sol` 的配置下（skew=1e6），A14 没有闭合。

### F. 完整重跑（数小时）
各实验的 `RUN_RECORD.md` 都有原样命令；T5 和 T6 各有驱动脚本 `run_t5.sh`、`run_t6.sh`。计时类结果在不同机器上会不同，按统计容差比较即可，不要求数值完全一致。

### G. Lean
| 对象 | 命令 |
|---|---|
| 历史文件的审计 | 在 `work/t7_proofs/T7-review_20261010/mech_copy` 中运行 `lake exe cache get && lake build`（预期 TNFF 失败），然后 `lake env lean ../Audit.lean` |
| 状态机模型 | 在 `work/t7_proofs/T7b-lean-statemachine_20261010` 中运行 `lake build && lake env lean Check.lean && lake env lean Sanity.lean` |

## 8. 我们没有声称的内容
- **没有安全证明。** 论文第 5 节的游戏和定理仍是纸面草稿，而且描述的是旧设计，需要按 v9.1 更新（#11 第 38–48 项）。（更正：原文写“第 4 节”。）Lean 只机检了门合约状态机的非密码学不变量。
- **可链接性"未检出"不是匿名性证明。** 它只覆盖所测的攻击和特征，阳性对照只证明能检出 D1 级（相等字）泄漏，没有弱泄漏对照；C3（master）在 8 个 parent 的规模下不可检验。D、动作字段、时间、gas 支付者都按设计公开。
- **证明密钥只用于评估，不是可信设置。**
  - phase 2 只有一次本地贡献；
  - 注册电路的 phase 1 是本地开发 ptau，不是 Hermez。
- **门限追责依赖可信分发者**，没有做 DKG。
- **没有在 mainnet-fork 或测试网上测**；没有扫描树高、fan-out、并发度、Δ；没有编译 D>4 的电路；E2 只用单发送者、固定顺序；规模化撤销只测了证书撤销，没测密钥撤销。
- **门合约已知但不修的行为**（不威胁研究目标，已披露）：`transferBudget` 证明不绑定 chainid 和门地址；构造函数不检查 TPK；msg.sender 不绑定（任何人可提交待处理证明）；运营方可通过 `updateIssuedRoot` 重新启用旧 issued 根。见 `POLICY_CLOSURE_V9.md`。
- **单机测量**：Apple M5 Pro，snarkjs，本地 anvil。

## 9. 已知偏差与问题的位置
- 每个实验的 RESULTS 都有"偏差"一节。
- 累计问题清单（19 条，含已修复的）在阶段报告第 8 节（PR #51，未合并）；审计 issue #53–#59 的处理见各 issue 的回复。
- 历史电路与论文数字的逐条对照在 `work/t1/CLAIM_EVIDENCE_MAP.md`。

一些对审计有用的线索：
- T3 v9 的第 1 次运行卡死，同时暴露出审计端的一个缺陷；第 2 次运行的 oracle 规则不够精确。两次的原始输出都已保留。
- E6b 的修正 A1（分组交叉验证的置换零分布）在分类器正式运行（`e54eb7d`）之前提交，但与全部数据和确定性结果在同一个提交 `cbe5594` 中，而且写于看到 seed 0 的计时运行之后；计时运行的输出没有保留。
- T5 冒烟测试中修了两处，都在正式运行前完成；冒烟运行发生在预注册之后、脚本提交之前，其输出没有保留，违反证据规则 2（已在 T5 RESULTS 文末更正）。
- T8 的 clean build 跑了三次，每次的原因都有记录。

## 10. 提问方式
- 在本仓库开 issue，标题以 `[audit]` 开头。
- 请注明你核验的提交哈希。
- 如果发现与本文或 RESULTS 不符的结果，请附上命令和输出。我们会追加更正，不会修改原始记录。
