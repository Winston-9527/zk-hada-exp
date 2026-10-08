// Oracle-vs-circuit agreement on every single-field mutation of a valid v7 instance (oracle_v7). usage: node v7/exhaustive_diff_v7.mjs D MODE
import { buildInstanceV7, R } from "../../t2_circuit_fix/zkdac_v7/scripts/lib_v7.mjs";
import { satisfiable as sat7 } from "../../t2_circuit_fix/zkdac_v7/scripts/witness_v7.mjs";
import { oracleV7, worldFromMetaV7 as worldFromMetaV5 } from "./oracle_v7.mjs";
const MODE = process.argv[3] ?? "C"; const buildInstanceV3 = (o) => buildInstanceV7({ mode: MODE, ...o }); const satisfiable = (D, m) => sat7(D, m, MODE); const oracleV3 = (m, W, D) => oracleV7(m, W, D, MODE);
const D = Number(process.argv[2] ?? 4); const { input: base, meta } = await buildInstanceV3({ D }); const W = worldFromMetaV5(meta); const clone = (o) => JSON.parse(JSON.stringify(o));
const WITNESS_ONLY = new Set(["m_sib", "m_bit", "r_sib", "r_bit", "r_low_value", "r_low_next_index", "r_low_next_value", "rt_depth", "rt_index", "rt_sib", "k_sib", "k_bit", "k_low_value", "k_low_next_index", "k_low_next_value", "acc_r", "acc_kx", "acc_ky"]);
// mode A: acc_e is a private placeholder constrained to 0 (not a public input) -> witness-only (run 1 of mode A mis-listed it as statement level)
if (MODE === "A") WITNESS_ONLY.add("acc_e");
const paths = []; for (const k of Object.keys(base)) { const v = base[k]; if (!Array.isArray(v)) paths.push([k]); else for (let i = 0; i < v.length; i++) { if (Array.isArray(v[i])) for (let j = 0; j < v[i].length; j++) paths.push([k, i, j]); else paths.push([k, i]); } }
const out = { D, mode: MODE, total: 0, agree: 0, disagreements_by_field: {} };
for (const p of paths) { const m = clone(base); let ref = m; for (const q of p.slice(0, -1)) ref = ref[q]; const l = p[p.length - 1]; ref[l] = (p[0] === "m_bit" || p[0] === "r_bit" || p[0] === "k_bit") ? (ref[l] === "0" ? "1" : "0") : ((BigInt(ref[l]) + 1n) % R).toString();
  const c = await satisfiable(D, m), o = (await oracleV3(m, W, D)).accept; out.total++;
  if (c === o) out.agree++; else { const key = `${p[0]} (circuit ${c ? "accept" : "reject"}, oracle ${o ? "accept" : "reject"})`; out.disagreements_by_field[key] = (out.disagreements_by_field[key] ?? 0) + 1; } }
out.statement_level_disagreements = Object.keys(out.disagreements_by_field).filter((k) => !WITNESS_ONLY.has(k.split(" ")[0]));
console.log(JSON.stringify(out, null, 1)); process.exit(0);
