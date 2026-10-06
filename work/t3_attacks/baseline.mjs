// Baseline (committed RQ108, 46,593) false-accept demonstration. Needs ../t1_recovery builds (see their RUN_RECORDs).
// 'expected' is the semantic expectation under the paper's stated relations; the full oracle does not apply to the baseline input format.
import { poseidon2 } from "poseidon-lite"; import fs from "fs"; import * as snarkjs from "snarkjs"; import path from "path"; import os from "os";
const T1 = new URL("../t1_recovery/", import.meta.url).pathname;
const base = JSON.parse(fs.readFileSync(T1 + "E0-rq108-witness_20261006/build/input_d4.json"));
const B = T1 + "E0-rq108-committed-variant_20261006/build";
const tmp = path.join(os.tmpdir(), "bl.wtns");
const ok = async (i) => { try { await snarkjs.wtns.calculate(i, `${B}/committed_js/committed.wasm`, tmp); return true; } catch { return false; } };
const clone = (o) => JSON.parse(JSON.stringify(o)); const rows = [];
const add = async (id, name, input, expected) => { const c = await ok(input); rows.push({ id, name, circuit: c ? "accept" : "reject", expected, class: c && expected === "reject" ? "FALSE_ACCEPT" : "AGREE" }); };
const v = clone(base); for (let k = 0; k < 4; k++) v[`eddsa_enabled_${k}`] = v[`merkle_enabled_${k}`] = v[`rev_enabled_${k}`] = "1";
await add("A00", "control valid, switches=1", v, "accept");
let m = clone(v); m.sig0_S = (BigInt(m.sig0_S) + 1n).toString(); await add("A01", "forged sig, switches=1", m, "reject");
for (let k = 0; k < 4; k++) m[`eddsa_enabled_${k}`] = "0"; await add("A01", "forged sig0, eddsa switches=0", m, "reject");
let g = clone(m); for (let k = 0; k < 4; k++) g[`merkle_enabled_${k}`] = g[`rev_enabled_${k}`] = "0"; g.issued_root = "12345"; g.revoked_root = "999"; await add("A01", "all switches 0, arbitrary roots", g, "reject");
// A07: same holder, same chain, N different nullifier secrets -> N distinct valid nullifiers
const DOMAIN = 18333019769n; let acc = 0; const seen = new Set();
for (let s = 1; s <= 5; s++) { const x = clone(v); x.nullifier_secret = String(s); x.expected_nullifier = poseidon2([BigInt(s), DOMAIN]).toString(); const c = await ok(x); if (c) { acc++; seen.add(x.expected_nullifier); } }
rows.push({ id: "A07", name: "free nullifier secret: 5 different secrets for the same chain/action", circuit: `${acc}/5 accepted, ${seen.size} distinct nullifiers`, expected: "at most 1 nullifier per holder/action", class: seen.size > 1 ? "FALSE_ACCEPT" : "AGREE" });
const sum = {}; for (const r of rows) sum[r.class] = (sum[r.class] ?? 0) + 1;
console.log(JSON.stringify({ circuit: "baseline committed RQ108 (46,593)", summary: sum, rows }, null, 1)); process.exit(0);
