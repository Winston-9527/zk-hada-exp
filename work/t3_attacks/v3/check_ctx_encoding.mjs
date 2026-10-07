// The oracle's hand-written ABI encoder must agree with ethers (generator) on varied contexts, incl. params longer than 32 bytes.
import { ctxHashIndependent } from "./oracle_v3.mjs";
import { ctxHash, DEFAULT_CTX } from "../../t2_circuit_fix/zkdac_v3/scripts/lib_v3.mjs";
const cases = [{ ...DEFAULT_CTX, nonce: 1n }, { ...DEFAULT_CTX, nonce: 2n, params: "0x" }, { ...DEFAULT_CTX, nonce: 3n, params: "0x" + "ab".repeat(33) },
  { ...DEFAULT_CTX, nonce: 4n, chainId: 1n, method: "0x095ea7b3", amount: 10n ** 30n }];
let ok = 0; for (const c of cases) { const a = ctxHashIndependent(c), b = ctxHash(c); console.log(a === b ? "match" : "MISMATCH", c.params.length); if (a === b) ok++; }
console.log(`${ok}/${cases.length}`); process.exit(ok === cases.length ? 0 : 1);
