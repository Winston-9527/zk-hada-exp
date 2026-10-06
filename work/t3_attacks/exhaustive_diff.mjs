// Oracle-vs-circuit agreement on every single-field mutation of a valid D instance (sanity check of the oracle itself).
import { buildInstance, R } from "../t2_circuit_fix/zkdac_v2/scripts/lib.mjs"; import { satisfiable } from "../t2_circuit_fix/zkdac_v2/scripts/witness.mjs"; import { oracle, worldFromMeta } from "./oracle.mjs";
const D = Number(process.argv[2] ?? 4); const { input: base, meta } = await buildInstance({ D }); const W = worldFromMeta(meta); const clone = (o) => JSON.parse(JSON.stringify(o));
const paths = []; for (const k of Object.keys(base)) { const v = base[k]; if (!Array.isArray(v)) paths.push([k]); else for (let i = 0; i < v.length; i++) { if (Array.isArray(v[i])) for (let j = 0; j < v[i].length; j++) paths.push([k, i, j]); else paths.push([k, i]); } }
const out = { D, total: 0, agree: 0, disagreements: [] };
for (const p of paths) { const m = clone(base); let ref = m; for (const q of p.slice(0, -1)) ref = ref[q]; const l = p[p.length - 1]; ref[l] = p[0] === "m_bit" ? (ref[l] === "0" ? "1" : "0") : ((BigInt(ref[l]) + 1n) % R).toString();
  const c = await satisfiable(D, m), o = (await oracle(m, W, D)).accept; out.total++; if (c === o) out.agree++; else out.disagreements.push({ field: p.join("."), circuit: c, oracle: o }); }
console.log(JSON.stringify(out, null, 1)); process.exit(0);
