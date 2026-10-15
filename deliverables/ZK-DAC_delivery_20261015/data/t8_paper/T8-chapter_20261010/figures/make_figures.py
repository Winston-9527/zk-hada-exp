# T8 figures (PLAN.md §2). Every plotted value is read from a result file of this repository; nothing is typed in.
# usage: .venv/bin/python figures/make_figures.py   (writes figures/F*.pdf and .png)
import json, os, statistics as st
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

HERE = os.path.dirname(os.path.abspath(__file__)); W = os.path.abspath(os.path.join(HERE, "../../.."))
P = lambda *a: os.path.join(W, *a)
# validated categorical palette (dataviz reference instance, light mode; validator: all checks pass, contrast WARN -> direct labels + tables)
C = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"]
INK, MUTED, GRID = "#1f1f1e", "#6b6a64", "#e4e3dd"
plt.rcParams.update({"font.size": 8, "axes.edgecolor": MUTED, "axes.labelcolor": INK, "xtick.color": MUTED, "ytick.color": MUTED,
                     "axes.spines.top": False, "axes.spines.right": False, "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.6,
                     "axes.axisbelow": True, "legend.frameon": False, "pdf.fonttype": 42})
jl = lambda p: [json.loads(l) for l in open(p) if l.strip()]
def save(fig, name):
    fig.tight_layout(); fig.savefig(os.path.join(HERE, name + ".pdf"), bbox_inches="tight"); fig.savefig(os.path.join(HERE, name + ".png"), dpi=200, bbox_inches="tight"); plt.close(fig)

# ---------- F1: lifecycle latency by stage, D = 1..4 (T5 E4a steady, N = 30 per D) + cold-process local totals ----------
T5 = P("t5_e2e/T5-e2e-scale_20261010/results")
steady = [r for r in jl(f"{T5}/e4a_steady.jsonl") if r.get("kind") == "measured" and r.get("status") == 1]
cold = [r for r in jl(f"{T5}/e4a_cold.jsonl") if r.get("status") == 1]
groups = [("fetch + assembly", ["S1_fetch", "S2_assembly"]), ("witness", ["S3_witness"]), ("proving", ["S4_prove"]), ("verify + submit + inclusion", ["S5_verify", "S6_submit", "S7_inclusion"])]
fig, ax = plt.subplots(figsize=(3.4, 2.9))
Ds = [1, 2, 3, 4]; bottoms = [0.0] * 4
for gi, (lab, keys) in enumerate(groups):
    vals = [st.mean(sum(r["T"][k] for k in keys) for r in steady if r["D"] == D) / 1000 for D in Ds]
    ax.bar(Ds, vals, bottom=bottoms, width=0.6, color=C[gi], label=lab, edgecolor="white", linewidth=1)
    bottoms = [b + v for b, v in zip(bottoms, vals)]
cl = [st.mean(r["local_ms"] for r in cold if r["D"] == D) / 1000 for D in Ds]
ax.scatter(Ds, cl, marker="D", s=14, color=INK, zorder=3, label="cold process, local (S1–S4)")
for D, b in zip(Ds, bottoms): ax.annotate(f"{b:.2f} s", (D, b), textcoords="offset points", xytext=(0, 3), ha="center", fontsize=7, color=INK)
ax.set_xticks(Ds); ax.set_xlabel("delegation depth D"); ax.set_ylabel("seconds (mean, steady state)"); ax.set_ylim(0, max(bottoms) * 1.15)
ax.legend(fontsize=6.2, loc="upper center", bbox_to_anchor=(0.5, -0.22), ncol=2); save(fig, "F1_latency_by_stage")

# ---------- F2: execute gas vs popcount(note index) (T5 epoch 1, D = 4) + fitted law + B0 plaintext (T6) + verifier-only (T5) ----------
rows = [json.loads(l) for l in open(f"{T5}/e4b_epoch1_rows.jsonl")]
ok = sorted([r for r in rows if r["status"] == 1], key=lambda r: (r["block"], r["txIndex"]))
pts = {}
for k, r in enumerate(ok):
    if r["D"] == 4: pts.setdefault(bin(2600 + k).count("1"), []).append(r["gasUsed"])
xs = sorted(pts); ys = [st.mean(pts[x]) / 1000 for x in xs]
law = open(f"{T5}/gas_vs_note_index.txt").read().split("gas = ")[1]
a0, a1, a2 = [float(t) for t in [law.split(" + ")[0], law.split(" + ")[1].split(" *")[0], law.split(" + ")[2].split(" *")[0]]]
b0 = json.load(open(P("t6_baselines/T6-baselines_20261010/results/b0_anvil.json")))
b0d4 = st.median(r["first"]["gasUsed"] for r in b0["rows"] if r["D"] == 4) / 1000
vg = [json.loads(l) for l in open(f"{T5}/e4a_verifier_gas.jsonl")]; v4 = next(v for v in vg if v["D"] == 4)["verifier_exec_gas"] / 1000
fig, ax = plt.subplots(figsize=(3.4, 2.9))
xr = list(range(0, 13))
ax.plot(xr, [(a0 + a1 * x + a2 * 4) / 1000 for x in xr], color=C[0], linewidth=2, label="v9 law (fit, R² ≈ 1)")
ax.scatter(xs, ys, s=16, color=C[0], edgecolor="white", linewidth=1.5, zorder=3, label="v9 measured (D = 4, mean per popcount)")
ax.axhline(b0d4, color=C[1], linewidth=2, linestyle="--", label="B0 plaintext chain (D = 4)")
ax.axhline(v4, color=C[2], linewidth=2, linestyle=":", label="verifier only (D = 4)")
ax.set_xlabel("popcount of the change note's insertion index"); ax.set_ylabel("gas (thousands)"); ax.set_ylim(0, 950)
ax.set_xticks(range(0, 13, 2)); ax.legend(fontsize=6.2, loc="upper center", bbox_to_anchor=(0.5, -0.22), ncol=1); save(fig, "F2_gas_vs_note_index")

# ---------- F3: component cost, proving time v6..v9 by D (T6 comp_bench, N = 30 per cell) ----------
cb = jl(P("t6_baselines/T6-baselines_20261010/results/comp_bench.jsonl"))
vers = [("v6", "v6 chain + revocation"), ("v7", "v7 + accountability"), ("v8", "v8 + budget note"), ("v9", "v9 compressed inputs")]
fig, ax = plt.subplots(figsize=(3.4, 2.4)); w = 0.2
for vi, (v, lab) in enumerate(vers):
    m = [st.mean(r["prove_ms"] for r in cb if r["D"] == D and r["version"] == v) / 1000 for D in Ds]
    s = [st.stdev(r["prove_ms"] for r in cb if r["D"] == D and r["version"] == v) / 1000 for D in Ds]
    ax.bar([D + (vi - 1.5) * w for D in Ds], m, width=w * 0.92, color=C[vi], label=lab, yerr=s, error_kw={"elinewidth": 0.6, "capsize": 1.5, "ecolor": INK})
ax.set_xticks(Ds); ax.set_xlabel("delegation depth D"); ax.set_ylabel("proving time (s, mean ± SD)")
ax.legend(fontsize=6.2, loc="upper left"); save(fig, "F3_component_cost")
print("figures written to", HERE)
