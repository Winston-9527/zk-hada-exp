import { buildInstance } from "../t2_circuit_fix/zkdac_v2/scripts/lib.mjs"; import crypto from "crypto";
const lowbits = (x, n) => BigInt(x) & ((1n << BigInt(n)) - 1n);
const { meta: m0 } = await buildInstance({ D: 4 }); const hc = BigInt(m0.cert[1]); const mk = [];
for (let n = 1n; mk.length < 2; n++) { const c = BigInt("0x" + crypto.createHash("sha256").update("h" + n).digest("hex").slice(0, 60)); if (lowbits(c, 17) === lowbits(hc, 17) && c !== hc) mk.push(c); }
const { meta } = await buildInstance({ D: 4, extraRevoked: mk });
const res = await meta.smt.find(BigInt(meta.cert[1]));
console.log("unpadded exclusion-proof length for honest cert1:", res.siblings.length, "(circuit RD = 16)", "found:", res.found);
process.exit(0);
