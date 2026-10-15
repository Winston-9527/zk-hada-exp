# T5 post-hoc (NOT pre-registered; exploratory): execute gas of the 1,230 epoch-1 actions vs the LeanIMT insertion index of the change note.
# Insertion order = (block, txIndex); index = 2,600 (note leaves before epoch 1) + rank. usage: python3 gas_vs_note_index.py > results/gas_vs_note_index.txt
import json
rows = [json.loads(l) for l in open("results/e4b_epoch1_rows.jsonl")]
ok = sorted([r for r in rows if r["status"] == 1], key=lambda r: (r["block"], r["txIndex"]))
data = [(bin(2600 + k).count("1"), r["D"], r["gasUsed"]) for k, r in enumerate(ok)]
# OLS gas ~ 1 + popcount + D via normal equations (pure python)
X = [[1.0, p, d] for p, d, _ in data]; y = [g for _, _, g in data]
XtX = [[sum(a[i] * a[j] for a in X) for j in range(3)] for i in range(3)]; Xty = [sum(a[i] * v for a, v in zip(X, y)) for i in range(3)]
def solve(A, b):
    A = [r[:] + [v] for r, v in zip(A, b)]; n = len(A)
    for i in range(n):
        p = max(range(i, n), key=lambda r: abs(A[r][i])); A[i], A[p] = A[p], A[i]
        for r in range(n):
            if r != i: f = A[r][i] / A[i][i]; A[r] = [x - f * z for x, z in zip(A[r], A[i])]
    return [A[i][n] / A[i][i] for i in range(n)]
b = solve(XtX, Xty); pred = [sum(c * x for c, x in zip(b, a)) for a in X]; m = sum(y) / len(y)
r2 = 1 - sum((v - q) ** 2 for v, q in zip(y, pred)) / sum((v - m) ** 2 for v in y); maxres = max(abs(v - q) for v, q in zip(y, pred))
print(f"n = {len(y)}; gas = {b[0]:.0f} + {b[1]:.0f} * popcount(note index) + {b[2]:.0f} * D ; R^2 = {r2:.6f}; max |residual| = {maxres:.0f} gas")
print("popcount  n(D=4)  mean gas (D=4)")
for pc in sorted({p for p, _, _ in data}):
    g = [v for p, d, v in data if p == pc and d == 4]
    if g: print(f"{pc:8d}  {len(g):6d}  {sum(g) / len(g):.0f}")
