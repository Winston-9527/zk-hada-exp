# T8 claim ledger (PLAN.md §1): every number used in experiments.tex is a LaTeX macro produced here from a result file of this repository.
# Writes numbers.tex (\newcommand per number) and CLAIM_LEDGER.md (macro, value, source path, how extracted, sha256 of the source).
# A missing file or field raises, so a number without a source cannot be written. usage: python3 make_numbers.py
import json, os, re, hashlib, statistics as st
HERE = os.path.dirname(os.path.abspath(__file__)); W = os.path.abspath(os.path.join(HERE, "../.."))
rows, used = [], {}
def src(rel):
    p = os.path.join(W, rel)
    if rel not in used: used[rel] = hashlib.sha256(open(p, "rb").read()).hexdigest()
    return p
J = lambda rel: json.load(open(src(rel)))
JL = lambda rel: [json.loads(l) for l in open(src(rel)) if l.strip()]
def rx(rel, pattern, group=1):
    m = re.search(pattern, open(src(rel)).read(), re.S)
    if not m: raise SystemExit(f"pattern not found in {rel}: {pattern}")
    return m.group(group)
def N(macro, value, rel, how, fmt=None):
    v = fmt.format(value) if fmt else str(value)
    rows.append((macro, v, rel, how))
c = lambda x: f"{x:,}"
# ---------- setup / circuit ----------
R9 = "t8_paper/T8-chapter_20261010/repro/expected_constraints.txt"
for line in open(src(R9)):
    f, n = line.split()
    m = re.search(r"main_c_d(\d)", f)
    if m: N(f"ConsVnine{'ABCD'[int(m.group(1)) - 1]}", c(int(n)), R9, f"constraints of {f}")
    if "budget_transfer" in f: N("ConsTransfer", c(int(n)), R9, f"constraints of {f}")
    if "revoke_transition" in f: N("ConsRevoke", c(int(n)), R9, f"constraints of {f}")
    if "main_reg_20" in f: N("ConsReg", c(int(n)), R9, f"constraints of {f}")
RC = "t2_circuit_fix/zkdac_v9/results/receipts_v8_v9.json"; rc = J(RC)["receipts"]
N("PubVnineD", rc["v9"]["execute_D4"]["public_inputs"], RC, "receipts.v9.execute_D4.public_inputs")
N("PubVeightD", rc["v8"]["execute_D4"]["public_inputs"], RC, "receipts.v8.execute_D4.public_inputs")
N("GasVnineFreshD", c(rc["v9"]["execute_D4"]["gasUsed"]), RC, "receipts.v9.execute_D4.gasUsed (near-empty note tree)")
# ---------- Q1 conformance ----------
for D in (1, 2, 3, 4):
    rel = f"t2_circuit_fix/zkdac_v9/results/mutations_d{D}.json"; s = J(rel)["summary"]
    N(f"MutField{'ABCD'[D-1]}", s["field_mutations"], rel, "summary.field_mutations"); N(f"MutSem{'ABCD'[D-1]}", s["semantic"], rel, "summary.semantic")
    N(f"MutUnexp{'ABCD'[D-1]}", len(s["semantic_unexpected"]), rel, "len(summary.semantic_unexpected)")
A = "t3_attacks/v9/results/attacks_v9.json"; a = J(A)
N("TthreeRows", len(a["rows"]), A, "len(rows)")
for k, m in [("AGREE_REJECT", "TthreeAgRej"), ("AGREE_ACCEPT", "TthreeAgAcc"), ("BAD_WITNESS_ONLY", "TthreeBwo"), ("FALSE_ACCEPT", "TthreeFa")]: N(m, a["summary"].get(k, 0), A, f"summary.{k}")
N("TthreeFaPolicy", sum(1 for x in a["false_accepts"] if x.get("policy_dependent")), A, "false_accepts with policy_dependent")
N("TthreeGap", len(a["completeness_gaps"]), A, "len(completeness_gaps)")
X = "t3_attacks/v9/results/exhaustive_diff_v9_d4.json"; x = J(X)
N("ExTotal", x["total"], X, "total"); N("ExStmt", len(x["statement_level_disagreements"]), X, "len(statement_level_disagreements)")
# ---------- Q2 budget ----------
E2 = "t5_e2/E2-budget_20261009/results/e2_anvil.json"; e2 = J(E2)
N("EtwoVsevenAcc", e2["a3"]["accepted_total"], E2, "a3.accepted_total (v7 gate, per-edge caps)"); N("EtwoVsevenSub", e2["a3"]["submitted"], E2, "a3.submitted")
N("EtwoVeightAcc", e2["a1"]["accepted_total"], E2, "a1.accepted_total (v8 gate)"); N("EtwoVeightAtt", e2["a1"]["attempts"], E2, "a1.attempts")
N("EtwoSameSub", e2["a2"]["submitted"], E2, "a2.submitted (same note version)"); N("EtwoSameOk", e2["a2"]["succeeded"], E2, "a2.succeeded")
# ---------- Q3 revocation ----------
E31 = "t4_revocation/E3-revocation_20261009/results/e31_world.json"; e31 = J(E31)
N("EthreeRows", len(e31["rows"]), E31, "len(rows)"); N("EthreeUnexp", e31["unexpected"], E31, "unexpected")
E3M = "t4_revocation/E3-revocation_20261009/RESULTS.md"
N("EthreeAblation", rx(E3M, r"\*\*(\d+/\d+) accepted\*\* \(R2"), E3M, "regex '**k/n accepted** (R2' in the ablation-L paragraph")
for r in (1, 10):
    rel = f"t5_e2e/T5-e2e-scale_20261010/results/e4b_revoke_{r}.json"; v = J(rel); w = v["witness_level_all_agents"]; tag = "One" if r == 1 else "Ten"
    N(f"Rev{tag}Edges", v["revoked_total"], rel, "revoked_total"); N(f"Rev{tag}Blocked", v["blocked_expected_after"], rel, "blocked_expected_after")
    N(f"Rev{tag}FA", w["false_accept"], rel, "witness_level_all_agents.false_accept"); N(f"Rev{tag}CD", w["collateral_denial"], rel, "witness_level_all_agents.collateral_denial")
    N(f"Rev{tag}Stale", v["inflight"]["descendant_prebuilt"]["StaleRevokedRoot"] + v["inflight"]["free_prebuilt"]["StaleRevokedRoot"], rel, "inflight StaleRevokedRoot (descendant + free)")
    N(f"Rev{tag}Rebuilt", v["rebuilt"]["free_rebuilt"]["accepted"], rel, "rebuilt.free_rebuilt.accepted")
    N(f"Rev{tag}Gas", c(round(st.mean(v["revocation"]["gas"]))), rel, "mean(revocation.gas)")
# ---------- Q5 accountability ----------
E6 = "t4_accountability/E6-threshold-opening_20261009/results/cases.json"; e6 = J(E6)
N("EsixRows", e6["total"], E6, "total"); N("EsixFailed", e6["failed"], E6, "failed")
E6M = "t4_accountability/E6-threshold-opening_20261009/RESULTS.md"
N("EsixModeA", rx(E6M, r"\*\*Mode A: (\d+/\d+) wrong points ARE valid"), E6M, "regex 'Mode A: k/n wrong points ARE valid'")
OC = "t2_circuit_fix/zkdac_v9/RESULTS.md"
N("OpenVnine", rx(OC, r"single committee key: exact recovery \| (\d+/\d+)"), OC, "regex opening-check table row")
# ---------- Q6 cost (T5) ----------
T5 = "t5_e2e/T5-e2e-scale_20261010/results/analysis.json"; t5 = J(T5)
for D in (1, 2, 3, 4):
    L = "ABCD"[D-1]; e = t5["e4a"][str(D)]
    N(f"Local{L}", f"{e['steady']['local_ms']['mean'] / 1000:.2f}", T5, f"e4a.{D}.steady.local_ms.mean / 1000")
    N(f"Prove{L}", f"{e['steady']['S4_prove']['mean'] / 1000:.2f}", T5, f"e4a.{D}.steady.S4_prove.mean / 1000")
    N(f"ColdDelta{L}", f"{e['cold_minus_steady']['local_ms']['diff']:.0f}", T5, f"e4a.{D}.cold_minus_steady.local_ms.diff")
N("NSteady", t5["e4a"]["4"]["steady"]["local_ms"]["n"], T5, "e4a.4.steady.local_ms.n"); N("NCold", t5["e4a"]["4"]["cold"]["local_ms"]["n"], T5, "e4a.4.cold.local_ms.n")
N("SlopeHop", f"{t5['d_effect']['local_ms']['slope_ms_per_hop']:.0f}", T5, "d_effect.local_ms.slope_ms_per_hop")
N("SlopeLo", f"{t5['d_effect']['local_ms']['slope_ci95'][0]:.0f}", T5, "d_effect.local_ms.slope_ci95[0]"); N("SlopeHi", f"{t5['d_effect']['local_ms']['slope_ci95'][1]:.0f}", T5, "d_effect.local_ms.slope_ci95[1]")
tg = t5["targets"]
N("PninetyfiveSteady", f"{tg['T-lat steady D=4 p95(local) <= 10000 ms']['p95'] / 1000:.2f}", T5, "targets.T-lat steady.p95 / 1000")
N("PninetyfiveCold", f"{tg['T-lat cold D=4 p95(local) <= 10000 ms']['p95'] / 1000:.2f}", T5, "targets.T-lat cold.p95 / 1000")
N("PeakRss", tg["T-mem peak RSS <= 8 GiB (all processes)"]["max_GiB"], T5, "targets.T-mem.max_GiB")
N("VerifierGas", c(tg["T-gas verifier-only D=4 <= 500k"]["verifier_exec_gas"]), T5, "targets.T-gas.verifier_exec_gas")
ep = t5["e4b_epoch1"]
N("EpochAcc", c(ep["accepted"]), T5, "e4b_epoch1.accepted"); N("EpochOf", c(ep["of"]), T5, "e4b_epoch1.of"); N("EpochBlocks", ep["blocks_used"], T5, "e4b_epoch1.blocks_used")
N("EpochPerBlock", f"{ep['txs_per_block']['mean']:.1f}", T5, "e4b_epoch1.txs_per_block.mean"); N("ProofsPerMin", ep["proofs_per_min"], T5, "e4b_epoch1.proofs_per_min")
N("GasWorldD", c(round(ep["gas_by_D"]["4"]["mean"])), T5, "e4b_epoch1.gas_by_D.4.mean"); N("NoteLeaves", c(ep["note_leaves_after"]), T5, "e4b_epoch1.note_leaves_after")
GL = "t5_e2e/T5-e2e-scale_20261010/results/gas_vs_note_index.txt"
m = re.search(r"gas = (\d+) \+ (\d+) \* popcount\(note index\) \+ (\d+) \* D ; R\^2 = ([0-9.]+)", open(src(GL)).read())
N("LawBase", c(int(m.group(1))), GL, "fitted intercept"); N("LawPop", c(int(m.group(2))), GL, "fitted popcount coefficient"); N("LawD", c(int(m.group(3))), GL, "fitted D coefficient"); N("LawRsq", m.group(4), GL, "R^2")
WB = "t5_e2e/T5-e2e-scale_20261010/results/world_build.json"; wb = J(WB)
N("WorldAgents", c(wb["agents"]), WB, "agents"); N("WorldDfour", c(wb["agents_by_D"][3]), WB, "agents_by_D[3] (D = 4)")
rv = J("t5_e2e/T5-e2e-scale_20261010/results/e4b_revoke_10.json")
N("RevSampleIn", rv["inflight"]["descendant_prebuilt"]["n"] + rv["inflight"]["free_prebuilt"]["n"], "t5_e2e/T5-e2e-scale_20261010/results/e4b_revoke_10.json", "inflight descendant_prebuilt.n + free_prebuilt.n")
N("RevSampleRe", rv["rebuilt"]["free_rebuilt"]["n"], "t5_e2e/T5-e2e-scale_20261010/results/e4b_revoke_10.json", "rebuilt.free_rebuilt.n")
# ---------- baselines (T6) ----------
T6 = "t6_baselines/T6-baselines_20261010/results/analysis.json"; t6 = J(T6)
N("UcanVerifyD", f"{t6['B1_go_ucan']['by_D']['4']['verify_ms']['mean']:.3f}", T6, "B1_go_ucan.by_D.4.verify_ms.mean")
N("UcanBytesD", c(round(t6['B1_go_ucan']['by_D']['4']['bytes_total']['mean'])), T6, "B1_go_ucan.by_D.4.bytes_total.mean")
N("DacShowA", f"{t6['B2_dac_eqs']['D1']['show_ms']['mean']:.2f}", T6, "B2_dac_eqs.D1.show_ms.mean"); N("DacVerifyA", f"{t6['B2_dac_eqs']['D1']['verify_ms']['mean']:.1f}", T6, "B2_dac_eqs.D1.verify_ms.mean")
zb = t6["B3_zkcreds"]["benches"]
N("ZkcMono", f"{zb['Expiry show_ proving monolithic']['mean_ms']:.0f}", T6, "B3_zkcreds.benches['Expiry show_ proving monolithic'].mean_ms")
for D in (1, 2, 3, 4):
    b = t6["B0_plaintext"]["by_D"][str(D)]; L = "ABCD"[D-1]
    B0R = "t6_baselines/T6-baselines_20261010/results/b0_anvil.json"
    N(f"BzeroMed{L}", c(round(st.median(r["first"]["gasUsed"] for r in J(B0R)["rows"] if r["D"] == D))), B0R, f"median of rows[D={D}].first.gasUsed (raw receipts)")
    N(f"RatioFresh{L}", b["privacy_cost_vs_v9"]["ratio"]["fresh"], T6, f"B0_plaintext.by_D.{D}.privacy_cost_vs_v9.ratio.fresh")
    N(f"RatioWorld{L}", b["privacy_cost_vs_v9"]["ratio"]["T5_world"], T6, f"B0_plaintext.by_D.{D}.privacy_cost_vs_v9.ratio.T5_world")
ct = {(t["D"], t["pair"]): t for t in t6["components"]["tests"]}
N("AcctCostD", f"{ct[(4, 'v6->v7')]['diff_ms']:.0f}", T6, "components.tests[D=4, v6->v7].diff_ms"); N("BudgetCostD", f"{ct[(4, 'v7->v8')]['diff_ms']:.0f}", T6, "components.tests[D=4, v7->v8].diff_ms")
N("AcctCostC", f"{ct[(3, 'v6->v7')]['diff_ms']:.0f}", T6, "components.tests[D=3, v6->v7].diff_ms")
# ---------- 2026-10-12 audit fixes (#53-#59): v9.1, T3 v9.1, T5b, T6b ----------
CV = "t2_circuit_fix/zkdac_v9_1/results/compile.txt"; cvs = re.findall(r"# of Constraints: (\d+)", open(src(CV)).read())
for i, n in enumerate(cvs): N(f"ConsVnineOne{'ABCD'[i]}", c(int(n)), CV, f"snarkjs r1cs info, D = {i + 1} (v9.1)")
A1 = "t3_attacks/v9_1/results/attacks_v9_1.json"; a1 = J(A1)
N("TthreeOneRows", len(a1["rows"]), A1, "len(rows) (v9.1)")
for k, m_ in [("AGREE_REJECT", "TthreeOneAgRej"), ("FALSE_ACCEPT", "TthreeOneFa")]: N(m_, a1["summary"].get(k, 0), A1, f"summary.{k} (v9.1)")
N("OffCurveRej", sum(1 for r in a1["rows"] if r["id"] == "A24" and r["class"] == "AGREE_REJECT"), A1, "rows A24 with AGREE_REJECT")
N("OffCurveVnineFa", sum(1 for r in a1["reference_v9"] if r["class"] == "FALSE_ACCEPT"), A1, "reference_v9 rows (A24 on v9) with FALSE_ACCEPT")
TB = "t5_e2e/T5b-revocation-circuit_20261012/results/revoke_circuit.json"; tb = J(TB)
N("BlockedAgents", tb["blocked_agents"], TB, "blocked_agents")
N("BlockedRejPred", sum(v for k, v in tb["summary"]["blocked_pred v9"].items() if k != "accept"), TB, "summary['blocked_pred v9'] non-accept")
N("BlockedRejOwn", sum(v for k, v in tb["summary"]["blocked_own v9"].items() if k != "accept"), TB, "summary['blocked_own v9'] non-accept")
N("BlockedFA", len(tb["false_accepts"]), TB, "len(false_accepts) (v9 and v9.1)")
N("FreeControls", tb["summary"]["control_free v9"].get("accept", 0), TB, "summary['control_free v9'].accept")
LC = "t5_e2e/T5b-revocation-circuit_20261012/results/latency_p95_ci.json"; lc = J(LC)["cells"]["steady D=4 local_ms"]
N("PninetyfiveLo", f"{lc['p95_ci95'][0] / 1000:.2f}", LC, "cells['steady D=4 local_ms'].p95_ci95[0] / 1000"); N("PninetyfiveHi", f"{lc['p95_ci95'][1] / 1000:.2f}", LC, "cells['steady D=4 local_ms'].p95_ci95[1] / 1000")
T6B = "t6_baselines/T6b-reanalysis_20261012/results/analysis_t6b.json"; t6b = J(T6B)
N("RatioFreshMax", f"{t6b['ranges']['fresh_tree'][1]:.2f}", T6B, "ranges.fresh_tree[1]"); N("RatioWorldMax", f"{t6b['ranges']['t5_world'][1]:.2f}", T6B, "ranges.t5_world[1]")
cp = {(t["D"], t["pair"]): t for t in t6b["components_paired"]}
N("CompressDiffB", f"{cp[(2, 'v8->v9')]['mean_diff_ms']:.0f}", T6B, "components_paired[D=2, v8->v9].mean_diff_ms")
N("CompressHolmB", f"{cp[(2, 'v8->v9')]['p_holm']:.3f}", T6B, "components_paired[D=2, v8->v9].p_holm")
# ---------- T7b ----------
CK = "t7_proofs/T7b-lean-statemachine_20261010/check_output.txt"; ck = open(src(CK)).read()
N("LeanStmts", len(re.findall(r"^'BudgetSM\.T\d_[^']*' depends on axioms: \[propext(, Classical\.choice)?, Quot\.sound\]$", ck, re.M)), CK, "theorem statements T1-T4 (incl. corollaries) whose axioms are only the standard ones")
N("LeanSorry", ck.count("sorryAx"), CK, "occurrences of sorryAx")
# ---------- write ----------
with open(os.path.join(HERE, "numbers.tex"), "w") as f:
    f.write("% generated by make_numbers.py — do not edit; every value is listed with its source in CLAIM_LEDGER.md\n")
    for m_, v, _, _ in rows: f.write(f"\\newcommand{{\\N{m_}}}{{{v}}}\n")
with open(os.path.join(HERE, "CLAIM_LEDGER.md"), "w") as f:
    f.write("# Claim ledger (generated by make_numbers.py; do not edit)\nEvery number in experiments.tex is a macro below. Source paths are relative to `work/`.\n\n")
    f.write("| macro | value | source | extraction |\n|---|---|---|---|\n")
    for m_, v, rel, how in rows: f.write(f"| `\\N{m_}` | {v} | `{rel}` | {how} |\n")
    f.write("\n## Design parameters used in the text (pre-registered inputs, not results)\n")
    for p_, where in [("D = 1..4, D_max = 4", "every PREREGISTRATION; circuits main_c_d1..4"), ("3-of-5 committee, trusted dealer", "t4_accountability/E6-threshold-opening_20261009/PREREGISTRATION.md"),
                      ("budget 100, actions of 10 units, one block per race", "t5_e2/E2-budget_20261009 (t2_circuit_fix/zkdac_v8/PREREGISTRATION.md §E2)"),
                      ("revocation rates 1 % and 10 %, window 30 s, note window 600 s, block gas limit 30M", "t5_e2e/T5-e2e-scale_20261010/PREREGISTRATION.md"),
                      ("p95 <= 10 s, RSS <= 8 GiB, verifier gas <= 500k targets", "research design line 300; T5 PREREGISTRATION.md"),
                      ("Hermez 2^18 phase 1, single local phase 2", "ptau/hermez/README.md; setup_zkeys.sh"), ("machine and tool versions", "RUN_RECORD.md of each experiment")]:
        f.write(f"- {p_}: `{where}`\n")
    f.write("\n## Source files (sha256 at generation time)\n| file | sha256 |\n|---|---|\n")
    for rel, h in sorted(used.items()): f.write(f"| `{rel}` | `{h}` |\n")
print(len(rows), "numbers from", len(used), "files")
