# T6 B2 (PREREGISTRATION.md Table 1): DAC from EQS (official, vendor/DAC-from-EQS @ 4ff86a33), only its public API (core.dac.DAC, as in tests/test_dac.py).
# The official code supports ONE delegation level: delegatee() returns a credential without an update key (no further delegation) and without the
# randomizer psi needed by proof_cred() for the new pseudonym, so a delegated credential cannot be shown through the API. Measured:
#   D = 1: issue_cred (root credential, k_prime = None) -> proof_cred -> verify_proof
#   D = 2: issue_cred (k_prime = 3) -> delegator -> delegatee -> spseq_uc.verify of the delegated credential (as test_issuing does); show: N/A
#   D = 3, 4: N/A (not implemented in the official code).
# usage: DYLD_LIBRARY_PATH=$(brew --prefix openssl@3)/lib vendor/dacenv/bin/python bench_dac.py 30 > results/dac_bench.json
import sys, json, time
sys.path.insert(0, "vendor/DAC-from-EQS")
from bplib.bp import BpGroup
from core.dac import DAC
from core.spseq_uc import EQC_Sign
N = int(sys.argv[1]); W = 3
dac = DAC(t=5, l_message=10); spseq = EQC_Sign(5)
pp, proof_vk, vk_stm, sk_ca, proof_alpha, alpha_stm = dac.setup(); (pp_sign, pp_zkp, pp_nizkp, vk_ca) = pp
# two attribute sets per root credential, as in the official test (with a single set, verify_cross fails inside set_commit: smoke run)
A1 = [["cap = 255", "expiry = 5000", "role = master"], ["method = transfer", "domain = d0a1", "tier = 1"]]; A2 = ["cap = 63", "expiry = 4000", "role = agent"]
D1 = [["cap = 255", "expiry = 5000"], ["method = transfer", "domain = d0a1"]]
def size(o):
    if isinstance(o, (tuple, list)): return sum(size(x) for x in o)
    if isinstance(o, dict): return sum(size(v) for v in o.values())
    if hasattr(o, "export"): return len(o.export())
    if hasattr(o, "binary"): return len(o.binary())
    if isinstance(o, (bytes, str)): return len(o)
    if isinstance(o, int): return (o.bit_length() + 7) // 8
    return 0
def ms(t): return (time.perf_counter() - t) * 1000
def d1():
    usk, upk = dac.user_keygen(pp); nym, sec, pn = dac.nym_gen(pp, usk, upk)
    t = time.perf_counter(); cred = dac.issue_cred(pp, attr_vector=A1, sk=sk_ca, nym_u=nym, k_prime=None, proof_nym_u=pn); ti = ms(t)
    t = time.perf_counter(); proof = dac.proof_cred(pp, nym_R=nym, aux_R=sec, cred_R=cred, Attr=A1, D=D1); ts = ms(t)
    t = time.perf_counter(); ok = dac.verify_proof(pp, proof, D1); tv = ms(t)
    bad = dac.verify_proof(pp, proof, [["cap = 255", "expiry = 9999"], ["method = transfer", "domain = d0a1"]])          # sanity: a subset not in the credential must fail (not timed)
    return {"D": 1, "issue_ms": ti, "show_ms": ts, "verify_ms": tv, "proof_bytes": size(proof), "accepted": bool(ok), "wrong_subset_rejected": not bad}
def d2():
    usk_u, upk_u = dac.user_keygen(pp); nym_u, sec_u, pn_u = dac.nym_gen(pp, usk_u, upk_u)
    usk_r, upk_r = dac.user_keygen(pp); nym_r, sec_r, pn_r = dac.nym_gen(pp, usk_r, upk_r)
    t = time.perf_counter(); cred = dac.issue_cred(pp, attr_vector=[list(a) for a in A1], sk=sk_ca, nym_u=nym_u, k_prime=3, proof_nym_u=pn_u); ti = ms(t)
    t = time.perf_counter(); c1 = dac.delegator(pp, cred, A2, l=3, sk_u=sec_u, proof_nym=pn_r); c2 = dac.delegatee(pp, c1, A2, sec_r, nym_r); td = ms(t)
    (sig, cv, ov, nymP, chi) = c2
    t = time.perf_counter(); ok = spseq.verify(pp_sign, vk_ca, nymP, cv, sig); tv = ms(t)
    return {"D": 2, "issue_ms": ti, "delegate_ms": td, "verify_cred_ms": tv, "show_ms": None, "cred_bytes": size((sig, cv, nymP)), "accepted": bool(ok)}
rows = []
for f in (d1, d2):
    for _ in range(W): f()
    for _ in range(N): rows.append(f())
print(json.dumps({"impl": "DAC-from-EQS 4ff86a3333ef0eedc74d0e94d177146a1ac16647", "python": sys.version.split()[0], "N": N, "warmup": W, "na": {"D2_show": "not exposed by the official API", "D3": "not implemented", "D4": "not implemented"}, "rows": rows}))
