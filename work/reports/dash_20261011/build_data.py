# Datasets for the shareable stage-report dashboard (2026-10-11). Every number is read from a result file of this repository;
# text rows (status, evidence path) restate STAGE_REPORT_20261011.md. usage: python3 build_data.py  (writes *.json next to this file)
import json, os, statistics as st, re
HERE = os.path.dirname(os.path.abspath(__file__)); W = os.path.abspath(os.path.join(HERE, "../.."))
P = lambda *a: os.path.join(W, *a)
J = lambda *a: json.load(open(P(*a)))
JL = lambda *a: [json.loads(l) for l in open(P(*a)) if l.strip()]
def out(name, rows): json.dump(rows, open(os.path.join(HERE, name + ".json"), "w"), ensure_ascii=False, indent=1)

T5 = J("t5_e2e/T5-e2e-scale_20261010/results/analysis.json"); T6 = J("t6_baselines/T6-baselines_20261010/results/analysis.json")
tg = T5["targets"]
out("targets", [
    {"target": "D=4 本地授权计算 p95（稳态）", "measured": tg["T-lat steady D=4 p95(local) <= 10000 ms"]["p95"] / 1000, "threshold": 10, "unit": "s", "pass": tg["T-lat steady D=4 p95(local) <= 10000 ms"]["pass"]},
    {"target": "D=4 本地授权计算 p95（冷启动进程）", "measured": tg["T-lat cold D=4 p95(local) <= 10000 ms"]["p95"] / 1000, "threshold": 10, "unit": "s", "pass": tg["T-lat cold D=4 p95(local) <= 10000 ms"]["pass"]},
    {"target": "峰值内存（全部进程）", "measured": tg["T-mem peak RSS <= 8 GiB (all processes)"]["max_GiB"], "threshold": 8, "unit": "GiB", "pass": tg["T-mem peak RSS <= 8 GiB (all processes)"]["pass"]},
    {"target": "验证器单独 gas（D=4）", "measured": tg["T-gas verifier-only D=4 <= 500k"]["verifier_exec_gas"], "threshold": 500000, "unit": "gas", "pass": tg["T-gas verifier-only D=4 <= 500k"]["pass"]}])

steady = [r for r in JL("t5_e2e/T5-e2e-scale_20261010/results/e4a_steady.jsonl") if r.get("kind") == "measured" and r.get("status") == 1]
lat = []
for D in (1, 2, 3, 4):
    s = [r for r in steady if r["D"] == D]; e = T5["e4a"][str(D)]
    m = lambda keys: round(st.mean(sum(r["T"][k] for k in keys) for r in s), 1)
    lat.append({"D": D, "fetch_assembly_ms": m(["S1_fetch", "S2_assembly"]), "witness_ms": m(["S3_witness"]), "prove_ms": m(["S4_prove"]),
                "verify_submit_inclusion_ms": m(["S5_verify", "S6_submit", "S7_inclusion"]), "local_mean_ms": e["steady"]["local_ms"]["mean"],
                "local_p95_ms": e["steady"]["local_ms"]["p95"], "cold_local_mean_ms": e["cold"]["local_ms"]["mean"], "n_steady": e["steady"]["local_ms"]["n"], "n_cold": e["cold"]["local_ms"]["n"]})
out("latency", lat)

rows = JL("t5_e2e/T5-e2e-scale_20261010/results/e4b_epoch1_rows.jsonl")
ok = sorted([r for r in rows if r["status"] == 1], key=lambda r: (r["block"], r["txIndex"]))
law = open(P("t5_e2e/T5-e2e-scale_20261010/results/gas_vs_note_index.txt")).read()
a0, a1, a2 = [int(x) for x in re.search(r"gas = (\d+) \+ (\d+) \* popcount\(note index\) \+ (\d+) \* D", law).groups()]
pts = {}
for k, r in enumerate(ok):
    if r["D"] == 4: pts.setdefault(bin(2600 + k).count("1"), []).append(r["gasUsed"])
out("gas_popcount", [{"popcount": pc, "gas_mean_d4": round(st.mean(v)), "actions": len(v), "law_d4": a0 + a1 * pc + a2 * 4} for pc, v in sorted(pts.items())])
b0 = J("t6_baselines/T6-baselines_20261010/results/b0_anvil.json")
vg = {v["D"]: v["verifier_exec_gas"] for v in JL("t5_e2e/T5-e2e-scale_20261010/results/e4a_verifier_gas.jsonl")}
gref = []
for D in (1, 2, 3, 4):
    gref.append({"D": D, "b0_plaintext_median": round(st.median(r["first"]["gasUsed"] for r in b0["rows"] if r["D"] == D)), "v9_fresh_tree": a0 + a2 * D,
                 "v9_t5_world_mean": round(T5["e4b_epoch1"]["gas_by_D"][str(D)]["mean"]), "verifier_only": vg[D]})
out("gas_by_depth", gref)

cb = JL("t6_baselines/T6-baselines_20261010/results/comp_bench.jsonl"); cons = T6["components"]["constraints"]
out("components", [{"version": v, "D": D, "prove_mean_ms": round(st.mean(r["prove_ms"] for r in cb if r["D"] == D and r["version"] == v), 1),
                    "prove_sd_ms": round(st.stdev(r["prove_ms"] for r in cb if r["D"] == D and r["version"] == v), 1), "n": sum(1 for r in cb if r["D"] == D and r["version"] == v),
                    "constraints": cons[v][D - 1]} for v in ("v6", "v7", "v8", "v9") for D in (1, 2, 3, 4)])

e2 = J("t5_e2/E2-budget_20261009/results/e2_anvil.json")
out("budget_races", [
    {"race": "v7 门：逐边限额，64 笔每笔 10", "budget": 100, "offered": e2["a3"]["submitted"] * 10, "accepted": e2["a3"]["accepted_total"]},
    {"race": "v8 门：32 个代理争抢同一预算", "budget": 100, "offered": e2["a1"]["attempts"] * 10, "accepted": e2["a1"]["accepted_total"]},
    {"race": "v8 门：同一 note 版本上的 12 笔", "budget": 100, "offered": e2["a2"]["submitted"] * 10, "accepted": e2["a2"]["accepted_total"]}])

rv = []
for r in (1, 10):
    x = J(f"t5_e2e/T5-e2e-scale_20261010/results/e4b_revoke_{r}.json"); w = x["witness_level_all_agents"]
    rv.append({"rate_pct": r, "edges_revoked": x["revoked_total"], "agents_blocked_expected": x["blocked_expected_after"], "agents_checked": w["agents"],
               "descendants_still_able": w["false_accept"], "unaffected_blocked": w["collateral_denial"],
               "inflight_rejected": x["inflight"]["descendant_prebuilt"]["StaleRevokedRoot"] + x["inflight"]["free_prebuilt"]["StaleRevokedRoot"],
               "inflight_sample": x["inflight"]["descendant_prebuilt"]["n"] + x["inflight"]["free_prebuilt"]["n"],
               "rebuilt_accepted": x["rebuilt"]["free_rebuilt"]["accepted"], "rebuilt_sample": x["rebuilt"]["free_rebuilt"]["n"],
               "revoke_gas_mean": round(st.mean(x["revocation"]["gas"])) if x["revocation"]["gas"] else None})
out("revocation", rv)

a = J("t3_attacks/v9/results/attacks_v9.json")
fa = a["false_accepts"]; pol = sum(1 for z in fa if z.get("policy_dependent"))
out("conformance", [{"class": "电路与 oracle 都拒绝", "rows": a["summary"]["AGREE_REJECT"]}, {"class": "都接受（合法用例）", "rows": a["summary"]["AGREE_ACCEPT"]},
                    {"class": "仅见证错误（语句为真）", "rows": a["summary"]["BAD_WITNESS_ONLY"]}, {"class": "电路接受、由合约负责（POLICY）", "rows": pol},
                    {"class": "电路接受、按设计在见证层接受", "rows": len(fa) - pol}, {"class": "完备性缺口", "rows": len(a["completeness_gaps"])}])

c = J("t4_privacy/E6b-linkability-v9_20261010/results/classifiers.json")["seeds"]["0"]
names = {"C1_same_agent": "同一智能体", "C2_sibling": "兄弟（同父）", "C3_master": "所属 master", "P1_C1_randomness_reuse": "对照 P1：复用密文随机数", "P2_C2_lineage_tag": "对照 P2：公开谱系标签"}
lk = []
for t, nm in names.items():
    for m in ("logreg", "rf", "knn"):
        r = c[t][m]
        lk.append({"test": nm, "model": {"logreg": "逻辑回归", "rf": "随机森林", "knn": "k 近邻"}[m], "auc": round(r["auc"], 3), "ci_low": round(r["ci95"][0], 3), "ci_high": round(r["ci95"][1], 3),
                   "within_fold_auc": round(r["within_fold_auc"], 3), "perm_p": round(r["perm_p"], 4), "control": t.startswith("P"),
                   "verdict": (("检出" if (r["ci95"][0] > 0.55 and r["perm_p"] < 0.01) else "未检出") if t.startswith("P") else c["decision"][f"{t}/{m}"].replace("no link detected", "未检测到链接").replace("LINK", "检测到链接"))})
out("linkability", lk)

bl = T6
out("baselines", [
    {"system": "ZK-DAC v9", "kind": "本系统", "D": 4, "show_or_prove_ms": T5["e4a"]["4"]["steady"]["local_ms"]["mean"], "verify_ms": T5["e4a"]["4"]["steady"]["S5_verify"]["mean"], "hidden_lineage": "是", "per_hop_revocation": "是", "budget": "是", "accountability": "门限强制打开", "onchain": "是"},
    {"system": "go-ucan", "kind": "官方实现", "D": 4, "show_or_prove_ms": bl["B1_go_ucan"]["by_D"]["4"]["invoke_ms"]["mean"], "verify_ms": bl["B1_go_ucan"]["by_D"]["4"]["verify_ms"]["mean"], "hidden_lineage": "否", "per_hop_revocation": "代码未实现", "budget": "否", "accountability": "谱系公开", "onchain": "否"},
    {"system": "DAC-EQS", "kind": "官方实现", "D": 1, "show_or_prove_ms": bl["B2_dac_eqs"]["D1"]["show_ms"]["mean"], "verify_ms": bl["B2_dac_eqs"]["D1"]["verify_ms"]["mean"], "hidden_lineage": "是", "per_hop_revocation": "否", "budget": "否", "accountability": "否", "onchain": "否"},
    {"system": "zk-creds", "kind": "官方实现", "D": None, "show_or_prove_ms": bl["B3_zkcreds"]["benches"]["Expiry show_ proving monolithic"]["mean_ms"], "verify_ms": bl["B3_zkcreds"]["benches"]["Expiry show_ verifying monolithic"]["mean_ms"], "hidden_lineage": "是", "per_hop_revocation": "否", "budget": "否", "accountability": "否", "onchain": "部分"},
    {"system": "ZKM 0.1.0-draft", "kind": "仅规范（代码 404）", "D": None, "show_or_prove_ms": None, "verify_ms": None, "hidden_lineage": "是", "per_hop_revocation": "否（推迟到 v2）", "budget": "是", "accountability": "仅自愿披露", "onchain": "是"},
    {"system": "ZK-ACE", "kind": "仅论文", "D": None, "show_or_prove_ms": None, "verify_ms": None, "hidden_lineage": "身份隐藏", "per_hop_revocation": "否（无委托）", "budget": "否", "accountability": "否", "onchain": "未报告"},
    {"system": "ZEBRA", "kind": "仅摘要", "D": None, "show_or_prove_ms": None, "verify_ms": None, "hidden_lineage": "是", "per_hop_revocation": "未核实", "budget": "否", "accountability": "可审计（机制未核实）", "onchain": "是"}])

out("experiments", [
    {"exp": "E0 源与语义闭合", "status": "按止损规则处理", "result": "历史数字无出处，从可信最小关系重建 v2→v9", "evidence": "work/t1/"},
    {"exp": "E1 攻击与差分", "status": "完成", "result": "T3 v9 共 170 行，POLICY 与按设计行之外无误接受，完备性缺口 0", "evidence": "work/t3_attacks/v9/"},
    {"exp": "E2 并发守恒", "status": "完成", "result": "逐边限额被超额花费；note 方案守住预算", "evidence": "work/t5_e2/E2-budget_20261009/"},
    {"exp": "E3 撤销与新鲜度", "status": "完成", "result": "逐跳撤销精确挡住后代，兄弟不受影响", "evidence": "work/t4_revocation/E3-revocation_20261009/"},
    {"exp": "E4 端到端与规模", "status": "完成", "result": "生命周期分解、D=1..4 曲线、1,230 个智能体并发", "evidence": "work/t5_e2e/T5-e2e-scale_20261010/"},
    {"exp": "E5 公平基线", "status": "完成", "result": "官方实现原生运行；无近邻具备完整组合", "evidence": "work/t6_baselines/T6-baselines_20261010/"},
    {"exp": "E6 隐私与 opening", "status": "完成", "result": "门限打开 65/65；v9 可链接性未检出，对照全检出", "evidence": "work/t4_privacy/E6b-linkability-v9_20261010/"},
    {"exp": "E7 状态与执行", "status": "完成（mainnet-fork 除外）", "result": "授权单调撤销；geth/anvil 真实收据与 gas 分解", "evidence": "work/t4_obligations/E7-obligations_20261009/"},
    {"exp": "E8 应用与独立复现", "status": "完成", "result": "实验章节、数字台账、clean build C1–C5 通过", "evidence": "work/t8_paper/T8-chapter_20261010/"}])

out("issues", [
    {"n": 1, "issue": "历史电路可绕过；论文多个数字无出处", "status": "已重建"},
    {"n": 2, "issue": "证书撤销条目无 salt，可被暴力识别", "status": "已披露"},
    {"n": 3, "issue": "运营方可重发旧根“撤销撤销”", "status": "已修"},
    {"n": 4, "issue": "每次撤销后所有在途证明在 Δ 后失效", "status": "已实测，可用性代价"},
    {"n": 5, "issue": "方案 A 的错误打开无法察觉", "status": "改用方案 C"},
    {"n": 6, "issue": "门限依赖可信 dealer", "status": "已披露"},
    {"n": 7, "issue": "证明者可复用密文随机数使自己可关联", "status": "只损害自己"},
    {"n": 8, "issue": "D=3 越过 2^17，证明时间跳变", "status": "未优化（可选）"},
    {"n": 9, "issue": "能力模型没有预算", "status": "已修（v8/v9）"},
    {"n": 10, "issue": "主代理在窗口内用旧证明", "status": "合约窗口处理"},
    {"n": 11, "issue": "执行 gas 随 note 树规模增长", "status": "论文需注明树规模"},
    {"n": 12, "issue": "note 根窗口限制同一快照上的并发证明数", "status": "已披露"},
    {"n": 13, "issue": "审计端遇到格式错误密文会卡死", "status": "已修"},
    {"n": 14, "issue": "历史 Lean 文件无效（编译失败、公理矛盾）", "status": "不得引用"},
    {"n": 15, "issue": "论文相关工作两句被 ZKM 推翻；ZK-ACE 行写错", "status": "已报甲方"},
    {"n": 16, "issue": "注册电路 phase 1 用本地开发 ptau", "status": "已披露"},
    {"n": 17, "issue": "可向已撤销子边委托（随即冻结）", "status": "非缺陷"},
    {"n": 18, "issue": "mainnet-fork 未跑", "status": "未做"},
    {"n": 19, "issue": "具体安全参数需按 BN254 重算", "status": "已报甲方"}])
print("datasets written:", sorted(f for f in os.listdir(HERE) if f.endswith(".json")))
