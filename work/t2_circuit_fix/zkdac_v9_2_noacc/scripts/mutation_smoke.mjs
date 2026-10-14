// T5c I3 item 5: the variant keeps v9.2's other checks. One fresh instance per D; honest must be SAT; holder_sk = 0, a wrong lineage certificate
// (cert expiry changed -> signature fails) and a wrong note root must be UNSAT, in both v9.2 and the variant. usage: node scripts/mutation_smoke.mjs
import os from "os"; import path from "path"; import { createRequire } from "module";
const here = new URL("..", import.meta.url).pathname, V92 = new URL("../../zkdac_v9_2/", import.meta.url).pathname;
const snarkjs = createRequire(here + "package.json")("snarkjs"); const { buildInstanceV9 } = await import(V92 + "scripts/lib_v9.mjs");
const ACC = ["tpk", "acc_r", "acc_kx", "acc_ky", "acc_c1x", "acc_c1y", "acc_c2x", "acc_c2y", "acc_e", "acc_esign"]; const tmp = path.join(os.tmpdir(), `i3mut-${process.pid}.wtns`);
const sat = async (dir, D, x) => { try { await snarkjs.wtns.calculate(x, `${dir}build/c${D}/main_c_d${D}_js/main_c_d${D}.wasm`, tmp); return "SAT"; } catch (e) { const m = String(e.message ?? e).match(/template (\S+) line: (\d+)/); return m ? `UNSAT ${m[1].replace(/_\d+$/, "")} L${m[2]}` : "UNSAT"; } };
const rows = [];
for (const D of [1, 2, 3, 4]) { const { input } = await buildInstanceV9({ D, seed: 3000 + D });
  const muts = { honest: (x) => x, "holder_sk = 0": (x) => { x.holder_sk = "0"; return x; }, "expiry[0] + 1": (x) => { x.expiry[0] = String(BigInt(x.expiry[0]) + 1n); return x; }, "note_root + 1": (x) => { x.note_root = String(BigInt(x.note_root) + 1n); return x; } };
  for (const [name, f] of Object.entries(muts)) { const on = f(structuredClone(input)); const off = f(structuredClone(input)); for (const k of ACC) delete off[k];
    rows.push({ D, mutation: name, v92: await sat(V92, D, on), noacc: await sat(here, D, off) }); } }
console.log(JSON.stringify(rows, null, 1)); process.exit(0);
