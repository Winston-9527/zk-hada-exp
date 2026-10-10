// T5 issuance microbenchmark (PREREGISTRATION.md E4a "Issuance"): child key generation + parent EdDSA-Poseidon signature over the certificate hash
// Poseidon7(hop, issuer key, holder key, cap, expiry). N = 30 fresh keys. The certificate hash formula is checked against 30 credentials of the world.
// usage: node issuance_bench.mjs > results/issuance_bench.json
import crypto from "crypto";
import * as C from "./common.mjs";
const { eddsa } = await C.L7.init(); const F = eddsa.F;
const creds = C.loadCreds(); let match = 0; const sample = C.shuffle(creds.filter((c) => c.D >= 2), "t5-issuance").slice(0, 30);
for (const c of sample) { const i = c.D - 1, x = c.input; if (String(C.PH([i, x.ent_Ax[i], x.ent_Ay[i], x.ent_Ax[i + 1], x.ent_Ay[i + 1], x.cap[i], x.expiry[i]])) === c.cert[i]) match++; }
const rows = [];
for (let r = 0; r < 30; r++) { const parent = crypto.randomBytes(32), x = sample[r].input, i = sample[r].D - 1;
  let t = performance.now(); const child = crypto.randomBytes(32); const A = eddsa.prv2pub(child); const tKey = performance.now() - t;
  t = performance.now(); const h = C.PH([i, x.ent_Ax[i], x.ent_Ay[i], F.toObject(A[0]), F.toObject(A[1]), x.cap[i], x.expiry[i]]); const sig = eddsa.signPoseidon(parent, F.e(h)); const tSign = performance.now() - t;
  if (!eddsa.verifyPoseidon(F.e(h), sig, eddsa.prv2pub(parent))) throw new Error("signature check failed");
  rows.push({ keygen_ms: +tKey.toFixed(3), hash_and_sign_ms: +tSign.toFixed(3) }); }
console.log(JSON.stringify({ n: rows.length, cert_formula_matches_world: `${match}/${sample.length}`, rows })); process.exit(0);
