// Cross-check on random data: predicted descent length of q = 1 + (2nd-largest number of low bits shared with any revoked key)
// (0 if fewer than two keys share the first bit), versus circomlibjs SMT find(). Issue #24.
import { newMemEmptyTrie } from "circomlibjs"; import crypto from "crypto";
const N = Number(process.argv[2] ?? 3000), Q = Number(process.argv[3] ?? 1000);
const rnd = (s) => BigInt("0x" + crypto.createHash("sha256").update(s).digest("hex").slice(0, 62));
const lcp = (a, b) => { let n = 0; while (n < 248 && ((a >> BigInt(n)) & 1n) === ((b >> BigInt(n)) & 1n)) n++; return n; };
const t = await newMemEmptyTrie(); const keys = [];
for (let i = 0; i < N; i++) { const k = rnd("k" + i); keys.push(k); await t.insert(k, 0n); }
let agree = 0, maxLen = 0; const mism = [];
for (let j = 0; j < Q; j++) {
  const q = rnd("q" + j); const s = keys.map((k) => lcp(k, q)).sort((a, b) => b - a);
  // walk: at level L the node on q's path holds every key sharing >= L low bits; descent stops at the first L with <= 1 such key
  let L = 0; while (keys.length && s.filter((x) => x >= L).length >= 2) L++;
  const res = await t.find(q); const got = res.siblings.length; maxLen = Math.max(maxLen, got);
  if (got === L) agree++; else mism.push({ j, predicted: L, got });
}
console.log(JSON.stringify({ N, Q, agree, maxObservedLen: maxLen, mismatches: mism.slice(0, 5) })); process.exit(0);
