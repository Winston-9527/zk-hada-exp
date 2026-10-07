// v3+IMT: validity, A13b liveness scenario, revocation negatives, and exhaustive single-field mutation (D=2). Issue #24.
import { buildInstanceV3IMT, refreshRevocation } from "./lib_v3imt.mjs";
import { oracleV3, worldFromMetaV3 } from "../../../t3_attacks/v3/oracle_v3.mjs";
import * as snarkjs from "snarkjs"; import crypto from "crypto"; import os from "os"; import path from "path";
const R = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const tmp = path.join(os.tmpdir(), "v3imt-" + process.pid + ".wtns");
const wasm = (D) => new URL(`../build/v3imt_d${D}/main_v3imt_d${D}_js/main_v3imt_d${D}.wasm`, import.meta.url).pathname;
const sat = async (D, input) => { try { await snarkjs.wtns.calculate(input, wasm(D), tmp); return true; } catch { return false; } };
const clone = (o) => JSON.parse(JSON.stringify(o));
const out = { valid: {}, a13b: [], revocation: [], exhaustive_d2: null };
for (const D of [1, 2, 3, 4]) { const { input } = await buildInstanceV3IMT({ D }); out.valid[D] = await sat(D, input); }
// A13b: honest cert with revoked keys sharing many low bits (the case that is unprovable for SMT RD=16)
const lowmask = (b) => (1n << BigInt(b)) - 1n, rnd = (s) => BigInt("0x" + crypto.createHash("sha256").update(s).digest("hex").slice(0, 60));
for (const shared of [17, 40, 200]) {
  const { meta: m0 } = await buildInstanceV3IMT({ D: 4 }); const hc = BigInt(m0.cert[1]);
  const extra = [0, 1, 2].map((j) => ((rnd(`x${shared}-${j}`) >> BigInt(shared)) << BigInt(shared)) | (hc & lowmask(shared)));
  const { input, meta } = await buildInstanceV3IMT({ D: 4, extraRevoked: extra });
  const c = await sat(4, input); const o = await oracleV3(input, { ...worldFromMetaV3(meta), revoked_roots: new Set([meta.imt.root]) }, 4);
  out.a13b.push({ shared_low_bits: shared, extra_revoked: 3, circuit: c, oracle: o.accept });
}
// revocation negatives at chain level
for (const i of [0, 1, 3]) {
  const { input, meta } = await buildInstanceV3IMT({ D: 4 });
  meta.imt.insert(BigInt(meta.cert[i]));
  const stale = clone(input); stale.revoked_root = meta.imt.root.toString();
  out.revocation.push({ case: `revoke cert ${i}: stale witness vs new root`, accepted: await sat(4, stale) });
  let honest = "no witness exists"; try { refreshRevocation(clone(input), meta); honest = "generator produced a witness (BUG)"; } catch { }
  out.revocation.push({ case: `revoke cert ${i}: honest re-proof`, result: honest });
  // use the predecessor leaf of the now-revoked cert in the new tree
  const k = BigInt(meta.cert[i]) & ((1n << 252n) - 1n), lo = meta.imt.lowIndex(k), low = meta.imt.leaves[lo], p = meta.imt.path(lo);
  const forged = clone(stale); forged.r_low_value[i] = low.value.toString(); forged.r_low_next_index[i] = low.nextIndex.toString(); forged.r_low_next_value[i] = low.nextValue.toString(); forged.r_sib[i] = p.sib.map(String); forged.r_bit[i] = p.bit.map(String);
  out.revocation.push({ case: `revoke cert ${i}: predecessor leaf in new tree`, accepted: await sat(4, forged) });
}
// exhaustive single-field mutation, D=2
{ const D = 2; const { input: base } = await buildInstanceV3IMT({ D }); const acc = []; let n = 0;
  const paths = []; for (const k of Object.keys(base)) { const v = base[k]; if (!Array.isArray(v)) paths.push([k]); else for (let i = 0; i < v.length; i++) { if (Array.isArray(v[i])) for (let j = 0; j < v[i].length; j++) paths.push([k, i, j]); else paths.push([k, i]); } }
  for (const p of paths) { const m = clone(base); let ref = m; for (const q of p.slice(0, -1)) ref = ref[q]; const l = p[p.length - 1];
    ref[l] = (p[0] === "m_bit" || p[0] === "r_bit") ? (ref[l] === "0" ? "1" : "0") : ((BigInt(ref[l]) + 1n) % R).toString(); n++; if (await sat(D, m)) acc.push(p.join(".")); }
  out.exhaustive_d2 = { mutations: n, accepted: acc }; }
console.log(JSON.stringify(out, null, 1)); process.exit(0);
