# Oracle 规则说明（一页）

对应代码：`work/t3_attacks/oracle.mjs`。目的：给出"一次授权声明是否应被接受"的**语义判定**，用来和电路做差分。请审阅者重点核对第 2 节的每条规则是否符合协议设计。

## 1. 输入与世界状态
- **声明（claim）**：电路的输入 JSON，即公开输入 `issued_root, revoked_root, action_digest, nullifier, now`，加私有的链（`ent_A*` 实体公钥、`sig_*` 签名、`cap` 能力位、`expiry` 过期时间）、持有者标量 `holder_sk`、动作上下文 `act_*`。
- **世界（world）**：
  - `registry`：已签发证书哈希的**集合**（不是 Merkle 树）。
  - `revoked`：已撤销证书哈希的**集合**（不是 SMT）。
  - `issued_roots / revoked_roots`：当前被认可的两个根。
  - `spent`：已用过的 nullifier 集合。
  - `trustedNow`：可信时钟（为空则不检查时钟）。

## 2. 判定规则（按代码顺序，任一条失败即拒绝）
| # | 规则 | 说明 |
|---|------|------|
| 1 | `issued_root`、`revoked_root` 必须是世界当前认可的根 | 严格模式：旧根算拒绝（策略层语义，见第 3 节） |
| 2 | 若设了可信时钟，`now` 必须等于它 | 否则不检查 |
| 3 | 实体数 = D+1 | 链长固定，无 padding |
| 4 | 对每一跳 i：`cap < 2^32`，`expiry < 2^64` | 范围合法 |
| 5 | 证书哈希 `H7(i, 签发者公钥, 持有者公钥, cap, expiry)` ∈ `registry` | 哈希用 poseidon-lite 独立计算 |
| 6 | 该哈希 ∉ `revoked` | 链上任何一跳被撤销即拒绝（级联撤销） |
| 7 | `now ≤ expiry_i` | 每张证书都未过期 |
| 8 | 签发者对该哈希的 EdDSA-Poseidon 签名有效 | 用 circomlibjs 验证 |
| 9 | i>0 时：`cap_i ⊆ cap_{i-1}`（按位子集），`expiry_i ≤ expiry_{i-1}` | 能力与时间只能衰减 |
| 10 | `holder_sk < 子群阶`，且 `holder_sk·Base8` = 末端持有者公钥 | 持有者必须知道私钥，且表示唯一（无别名） |
| 11 | `action_digest = H7(chain_id, verifier, method, params_hash, amount, req_cap, nonce)` | 动作被完整上下文绑定 |
| 12 | `req_cap ⊆ cap_{D-1}` | 所需能力被末端证书覆盖 |
| 13 | `nullifier = H3(tag, holder_sk, action_digest)` | nullifier 绑定持有者私钥和动作 |
| 14 | `nullifier ∉ spent` | 重放拒绝 |

链的连续性（第 i 张证书的持有者 = 第 i+1 张的签发者）不单独检查：证书哈希里的公钥数组共用同一个 `ent[i+1]`，所以由规则 5、8 隐含。

## 3. 刻意不判定 / 刻意放宽的地方
- **Merkle 路径、SMT 排除证明不检查。** oracle 判的是"语句是否应成立"，不是"witness 是否有效"。所以电路因路径错误而拒绝、oracle 接受的情形记为 `BAD_WITNESS_ONLY`。若诚实 witness 根本不存在则记为 `COMPLETENESS_GAP`（A13b）。
- **策略层行为单独标注。** 规则 1（根新鲜度）、2（时钟）、14（重放）属于 verifier/合约职责。电路单独接受而 oracle 拒绝时，结果记为 `FALSE_ACCEPT` 且标 `policy_dependent`，并**不**等同于电路缺陷，需要在 T4/E7 用合约验证。
- 不覆盖：恶意签发者或注册表、R1（域 nullifier / 人类唯一性）、R6（ElGamal 问责）、多 seed 统计。

## 4. 已知的不独立之处
- EdDSA 验证和 BabyJub 标量乘用的是 circomlibjs，生成器同样用它；Poseidon 用 poseidon-lite（独立）。
- 规则本身由实现者（Claude agent）根据论文和代码起草，**尚未经协议设计者审阅**。

## 5. 审阅结论（乙方，已回答）
1. 撤销粒度：**增加持有者密钥粒度**撤销 → #17（oracle 规则 6 待扩展，当前未实现）。
2. nullifier：**增加第二个（R1 每人每域）** → #17；注意放在哪个证明里会影响可关联性，设计待定。
3. 根新鲜度（规则 1）、时钟（规则 2）、重放（规则 14）：**属于 verifier 合约的义务，不写进电路** → #18。oracle 里这三条保留为"合约义务"的对照判定。
4. 能力位：**32 位按位子集先保留**；预算上限与时间范围（not-before）是否扩展，单独讨论 → #16。

注：以上决定尚未改动电路与 oracle 代码；v2 现状仍是第 2 节的规则。
