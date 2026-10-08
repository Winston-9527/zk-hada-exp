// Oracle-vs-circuit agreement on every single-field mutation of a valid v4 instance (oracle_v3 with the IMT revocation root).
import { buildInstanceV4 as buildInstanceV3, R } from "../../t2_circuit_fix/zkdac_v4/scripts/lib_v4.mjs";
import { satisfiable } from "../../t2_circuit_fix/zkdac_v4/scripts/witness_v4.mjs";
import { oracleV3, worldFromMetaV3 } from "../v3/oracle_v3.mjs";
const D = Number(process.argv[2] ?? 4); const { input: base, meta } = await buildInstanceV3({ D }); const W = worldFromMetaV3(meta, { revoked_roots: new Set([BigInt(meta.imt.root)]) }); const clone = (o) => JSON.parse(JSON.stringify(o));
const WITNESS_ONLY = new Set(["m_sib", "m_bit", "r_sib", "r_bit", "r_low_value", "r_low_next_index", "r_low_next_value"]);
const paths = []; for (const k of Object.keys(base)) { const v = base[k]; if (!Array.isArray(v)) paths.push([k]); else for (let i = 0; i < v.length; i++) { if (Array.isArray(v[i])) for (let j = 0; j < v[i].length; j++) paths.push([k, i, j]); else paths.push([k, i]); } }
const out = { D, total: 0, agree: 0, disagreements_by_field: {} };
for (const p of paths) { const m = clone(base); let ref = m; for (const q of p.slice(0, -1)) ref = ref[q]; const l = p[p.length - 1]; ref[l] = (p[0] === "m_bit" || p[0] === "r_bit") ? (ref[l] === "0" ? "1" : "0") : ((BigInt(ref[l]) + 1n) % R).toString();
  const c = await satisfiable(D, m), o = (await oracleV3(m, W, D)).accept; out.total++;
  if (c === o) out.agree++; else { const key = `${p[0]} (circuit ${c ? "accept" : "reject"}, oracle ${o ? "accept" : "reject"})`; out.disagreements_by_field[key] = (out.disagreements_by_field[key] ?? 0) + 1; } }
out.statement_level_disagreements = Object.keys(out.disagreements_by_field).filter((k) => !WITNESS_ONLY.has(k.split(" ")[0]));
console.log(JSON.stringify(out, null, 1)); process.exit(0);
