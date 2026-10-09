// E3.5 Monte Carlo (PREREGISTRATION.md): honest actions rejected as stale vs the revoked holder's exposure window Δ.
// usage: node e35_sim.mjs > results/e35_sim.json. Gate rule (ZkDacGateV7._rootOk): a root retired at u is accepted while block.timestamp <= u + Δ.
// An honest action starts at s with the root current at s, proves for τp ~ N(2.445, 0.019) s (v7 C D=4 bench), and is included after τi ~ U(0,12) + 12 s.
// It is rejected iff the first root update u after s satisfies u + Δ < s + τp + τi. Root updates: Poisson(λ). Seeded PRNG (xorshift128+).
let s0 = 0x9e3779b97f4a7c15n, s1 = 0xd1b54a32d192ed03n; const M = (1n << 64n) - 1n;
function rnd() { let x = s0, y = s1; s0 = y; x ^= (x << 23n) & M; s1 = x ^ y ^ (x >> 17n) ^ (y >> 26n); return Number(((s1 + y) & M) >> 11n) / 2 ** 53; }
const normal = (m, sd) => m + sd * Math.sqrt(-2 * Math.log(rnd() || 1e-300)) * Math.cos(2 * Math.PI * rnd());
const N = 100000, out = { date: new Date().toISOString(), N, model: "prove N(2.445, 0.019) s; inclusion U(0,12)+12 s; updates Poisson(λ); memoryless => first update after s ~ Exp(λ)", cells: [] };
for (const [label, lam] of [["1/hour", 1 / 3600], ["1/min", 1 / 60], ["1/12s", 1 / 12]]) for (const D of [0, 12, 60, 240]) {
  let rej = 0, analytic = 0;
  for (let k = 0; k < N; k++) { const tau = normal(2.445, 0.019) + 12 + 12 * rnd(); const u = -Math.log(1 - rnd()) / lam;   // first update after s (relative)
    if (u + D < tau) rej++; analytic += 1 - Math.exp(-lam * Math.max(0, tau - D)); }
  out.cells.push({ update_rate: label, delta_s: D, honest_rejected: +(rej / N).toFixed(5), analytic: +(analytic / N).toFixed(5), revoked_holder_exposure_s: D });
}
console.log(JSON.stringify(out, null, 1));
