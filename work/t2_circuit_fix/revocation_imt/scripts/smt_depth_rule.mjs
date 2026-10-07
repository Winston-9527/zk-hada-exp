// Calibrate the SMT liveness rule against circomlibjs + the real RD=16 circuit (issue #24).
// For a query q we insert revoked keys sharing exactly b low bits with q (b = 10..20, 1 or 2 or 3 such keys) plus random keys,
// then record: L = length of q's descent path (number of levels walked), and whether an RD=16 exclusion witness exists.
import { newMemEmptyTrie } from "circomlibjs"; import * as snarkjs from "snarkjs"; import crypto from "crypto"; import os from "os"; import path from "path";
const RD = 16, WASM = new URL(`../build/main_smt_${RD}_js/main_smt_${RD}.wasm`, import.meta.url).pathname, tmp = path.join(os.tmpdir(), "smtcal.wtns");
const rnd = (s) => BigInt("0x" + crypto.createHash("sha256").update(s).digest("hex").slice(0, 62));
const lowmask = (b) => (1n << BigInt(b)) - 1n;
// number of low bits shared by a and b
const lcp = (a, b) => { let n = 0; while (n < 250 && ((a >> BigInt(n)) & 1n) === ((b >> BigInt(n)) & 1n)) n++; return n; };
const rows = [];
for (let b = 10; b <= 20; b++) for (const cnt of [1, 2, 3]) {
  const q = rnd(`q-${b}-${cnt}`), t = await newMemEmptyTrie(); const keys = [];
  for (let j = 0; j < cnt; j++) { // share exactly b low bits with q: same low b bits, bit b differs, rest random
    const hi = rnd(`h-${b}-${cnt}-${j}`) >> BigInt(b + 1);
    const k = (hi << BigInt(b + 1)) | ((((q >> BigInt(b)) & 1n) ^ 1n) << BigInt(b)) | (q & lowmask(b)); keys.push(k); await t.insert(k, 0n); }
  for (let j = 0; j < 50; j++) { const k = rnd(`r-${b}-${cnt}-${j}`); keys.push(k); await t.insert(k, 0n); }
  const res = await t.find(q); const F = t.F; const sib = res.siblings.map((x) => F.toObject(x));
  let lastNZ = -1; sib.forEach((x, i) => { if (x !== 0n) lastNZ = i; });
  const s = [...sib]; let provable = false;
  if (s.length <= RD) { while (s.length < RD) s.push(0n);
    try { await snarkjs.wtns.calculate({ key: q.toString(), root: F.toObject(t.root).toString(), siblings: s.map(String), oldKey: res.isOld0 ? "0" : F.toObject(res.notFoundKey).toString(), oldValue: res.isOld0 ? "0" : F.toObject(res.notFoundValue).toString(), isOld0: res.isOld0 ? "1" : "0" }, WASM, tmp); provable = true; } catch { provable = false; } }
  const shared = keys.map((k) => lcp(k, q)).sort((x, y) => y - x);
  rows.push({ b, cnt, pathLen: sib.length, lastNonZeroSibling: lastNZ + 1, top2shared: shared.slice(0, 2), provableRD16: provable });
}
console.log(JSON.stringify(rows)); process.exit(0);
