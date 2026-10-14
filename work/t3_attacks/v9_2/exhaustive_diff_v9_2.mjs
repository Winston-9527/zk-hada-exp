// v9.2 copy: exhaustive_diff_v9_1.mjs with imports -> zkdac_v9_2.
// v9.1 copy: imports -> zkdac_v9_1; witness-only filter applied only to (circuit reject, oracle accept) (#57). usage: node v9_1/exhaustive_diff_v9_1.mjs D
// Oracle-vs-circuit agreement on every single-field mutation of a valid v9 instance (oracle_v9). usage: node v9/exhaustive_diff_v9.mjs D
// Field mutations are raw (no re-derivation): a mutated private root is NOT followed by a recomputed state_root here.
import { buildInstanceV9, R } from "../../t2_circuit_fix/zkdac_v9_2/scripts/lib_v9.mjs";
import { satisfiable } from "../../t2_circuit_fix/zkdac_v9_2/scripts/witness_v9.mjs";
import { oracleV9, worldFromMetaV9 } from "../v9/oracle_v9.mjs";
const D = Number(process.argv[2] ?? 4); const { input: base, meta } = await buildInstanceV9({ D }); const W = worldFromMetaV9(meta); const clone = (o) => JSON.parse(JSON.stringify(o));
// witness representation only (paths, low-leaf witnesses, encryption randomness, note-tree path): circuit may reject while the plaintext statement holds
const WITNESS_ONLY = new Set(["m_sib", "m_bit", "r_sib", "r_bit", "r_low_value", "r_low_next_index", "r_low_next_value", "rt_depth", "rt_index", "rt_sib", "k_sib", "k_bit", "k_low_value", "k_low_next_index", "k_low_next_value", "acc_r", "acc_kx", "acc_ky", "nt_depth", "nt_index", "nt_sib"]);
const BITS = new Set(["m_bit", "r_bit", "k_bit"]);
const paths = []; for (const k of Object.keys(base)) { const v = base[k]; if (!Array.isArray(v)) paths.push([k]); else for (let i = 0; i < v.length; i++) { if (Array.isArray(v[i])) for (let j = 0; j < v[i].length; j++) paths.push([k, i, j]); else paths.push([k, i]); } }
const out = { D, total: 0, agree: 0, disagreements_by_field: {} };
for (const p of paths) { const m = clone(base); let ref = m; for (const q of p.slice(0, -1)) ref = ref[q]; const l = p[p.length - 1]; ref[l] = BITS.has(p[0]) ? (ref[l] === "0" ? "1" : "0") : ((BigInt(ref[l]) + 1n) % R).toString();
  const c = await satisfiable(D, m), o = (await oracleV9(m, W, D)).accept; out.total++;
  if (c === o) out.agree++; else { const key = `${p[0]} (circuit ${c ? "accept" : "reject"}, oracle ${o ? "accept" : "reject"})`; out.disagreements_by_field[key] = (out.disagreements_by_field[key] ?? 0) + 1; } }
out.statement_level_disagreements = Object.keys(out.disagreements_by_field).filter((k) => !(WITNESS_ONLY.has(k.split(" ")[0]) && k.includes("circuit reject, oracle accept")));
console.log(JSON.stringify(out, null, 1)); process.exit(0);
