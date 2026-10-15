# ZK-DAC 实验结果交付包（2026-10-15）

## 先看哪个文件
- **`report/DELIVERY_REPORT_20261015.html`**：交付报告，双击即可在浏览器中打开。
  - 图和图表都已内嵌，离线也能完整显示；离线时字体会换成系统字体。
  - 窄屏（手机）和深色模式也能正常阅读。
- `report/DELIVERY_REPORT_20261015.md`：同一份报告的 Markdown 版。比 HTML 多一个附录 D（审计与更正）。

## data/ 里有什么
报告中引用的路径都是仓库 `work/` 下的相对路径。`data/` 保持同样的目录结构，所以报告里写的 `t5_e2e/T5d-key-revocation_20261014/...`，对应这里的 `data/t5_e2e/T5d-key-revocation_20261014/...`。

每个实验目录一般包含：

| 文件 | 内容 |
|---|---|
| `PREREGISTRATION.md` | 运行前推送的预注册，以及修正案 |
| `RESULTS.md` | 结果。更正追加在文件末尾，原文不改 |
| `RUN_RECORD.md` | 运行命令、环境和失败的尝试 |
| `MANIFEST.sha256` | 目录内文件的哈希 |
| `results/` | 原始输出（JSON / TXT） |
| `*.py`、`*.mjs` | 生成上述输出的分析和实验脚本 |

另外：
- `data/audit_corrections/FOLLOWUPS_20261016/` 是补做实验 F1–F3 的数据。
- `data/t8_paper/PAPER_SYNC_NOTES_20261015.md` 是给甲方的论文同步清单。
- `data/EVIDENCE_PROTOCOL.md` 是证据规则。

## 没有包含的内容
- 电路构建产物、zkey、ptau、proof fixtures 和 node_modules：体积大，而且都可以从仓库和 release 重新生成。
- 因此包里的脚本**不能直接运行**，需要先克隆完整仓库（见下）。这里的脚本只是供查阅的。
- 脚本中出现的私钥和助记词都是 anvil 公开的默认测试账户（`test test … junk`），只在本地测试链上使用，不是真实密钥。

## 版本
| 内容 | 仓库 `Winston-9527/zk-hada-exp` 中的位置 |
|---|---|
| 实验数据 | main @ `eae5864` |
| 补做实验 F1–F3 | 分支 `audit-followups-20261016` @ `2061c37`（PR #83，打包时**尚未合并**） |
| 报告 | 分支 `delivery-report-20261016` @ `9baf40c`（PR #84，打包时**尚未合并**） |

完整仓库：https://github.com/Winston-9527/zk-hada-exp 。第二环境的复现说明在 `data/t8_paper/T8b-v91-repro_20261013/repro/README.md`。

## 校验
`SHA256SUMS` 列出了包内每个文件的哈希。在包的根目录运行 `shasum -a 256 -c SHA256SUMS` 即可校验。
