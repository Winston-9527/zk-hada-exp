#!/usr/bin/env python3
"""E7 cross-client gas comparison (issue #18): the same signed-off fixtures and deployment sequence on
geth --dev (Osaka), anvil --hardfork osaka and anvil --hardfork cancun, all with chain id 1337.
Reads gasUsed from receipts. usage: python3 e2e_chains.py > results/e2e_chains.json"""
import json, subprocess, time, sys, os, shutil
PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"   # anvil's public test account #0 (local chains only)
DEPLOYER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
CHAIN_ID = 1337; SKEW = "3600"; WIN = "300"
SCRATCH = os.environ.get("SCRATCH", "/tmp")
HERE = os.path.dirname(os.path.abspath(__file__))

def run(args, cwd=HERE, ok=True, env=None):
    r = subprocess.run(args, capture_output=True, text=True, cwd=cwd, env=env)
    if ok and r.returncode: sys.exit(f"FAILED {' '.join(args)[:240]}\n{r.stdout[-400:]}\n{r.stderr[-800:]}")
    return r

# ---- deployment plan (identical nonce sequence on every client => identical addresses) ----
PLAN = [("v2", "d1"), ("v2", "d2"), ("v2", "pos"), ("v2", "ver"), ("v2", "tgt"), ("v2", "gate"),
        ("A", "d1"), ("A", "d2"), ("A", "pos"), ("A", "ver"), ("A", "tgt"), ("A", "gate"),
        ("B", "ver"), ("B", "tgt"), ("B", "gate")]
addr = {}
for n, key in enumerate(PLAN):
    addr[key] = run(["cast", "compute-address", DEPLOYER, "--nonce", str(n)]).stdout.split()[-1]

# ---- fixtures: generated once, used on all clients ----
NOW = int(time.time()) - 30
fx = {}
for v in ["v2", "A", "B"]:
    out = os.path.join(SCRATCH, f"chainfx_{v}.json")
    env = dict(os.environ, VARIANT=v, GATE=addr[(v, "gate")], TARGET=addr[(v, "tgt")], NOW=str(NOW), CHAIN_ID=str(CHAIN_ID), OUT=out)
    run(["node", "gen_fixtures.mjs"], env=env)
    fx[v] = json.load(open(out))

def init(rt): n = (len(rt) - 2) // 2; return "0x61" + format(n, "04x") + "80600c6000396000f3" + rt[2:]

def client_run(name, start_cmd, rpc, fund_from=None, pre=None):
    if pre: run(pre)
    proc = subprocess.Popen(start_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        if run(["cast", "chain-id", "--rpc-url", rpc], ok=False).returncode == 0: break
        time.sleep(0.2)
    res = {"client": name, "version": None}
    for _ in range(100):   # geth refuses receipt queries while its tx indexer initialises
        r = run(["cast", "rpc", "--rpc-url", rpc, "eth_getTransactionReceipt", "0x" + "00" * 32], ok=False)
        if "indexing" not in (r.stdout + r.stderr): break
        time.sleep(0.2)
    try:
        res["version"] = run(["cast", "rpc", "--rpc-url", rpc, "web3_clientVersion"]).stdout.strip().strip('"')
        assert int(run(["cast", "chain-id", "--rpc-url", rpc]).stdout) == CHAIN_ID
        if fund_from == "DEV":
            fund_from = json.loads(run(["cast", "rpc", "--rpc-url", rpc, "eth_accounts"]).stdout)[0]
        def receipt(h):
            # send async, then poll: geth --dev answers "transaction indexing is in progress" for unknown hashes at block 0
            for _ in range(150):
                r = run(["cast", "receipt", "--json", "--rpc-url", rpc, h], ok=False)
                if r.returncode == 0 and r.stdout.strip().startswith("{"): return json.loads(r.stdout)
                time.sleep(0.2)
            sys.exit(f"no receipt for {h} on {name}")
        if fund_from:
            receipt(run(["cast", "send", "--async", "--unlocked", "--from", fund_from, "--value", "1000ether", DEPLOYER, "--rpc-url", rpc]).stdout.strip())
        def send(*a, ok=True):
            r = run(["cast", "send", "--async", "--private-key", PK, "--rpc-url", rpc, *a], cwd=HERE + "/foundry", ok=ok)
            if r.returncode != 0: return {"status": "revert", "err": r.stderr.strip()[-160:]}   # rejected at gas estimation, never sent
            return receipt(r.stdout.strip())
        def create(contract, *args):
            r = run(["forge", "create", contract, "--json", "--broadcast", "--private-key", PK, "--rpc-url", rpc,
                     *(["--constructor-args", *args] if args else [])], cwd=HERE + "/foundry")
            return json.loads(r.stdout)["deployedTo"]
        got = {}
        for v, key in PLAN:
            f = fx[v]; pd = f["poseidonData"]
            if key == "d1": got[(v, key)] = send("--create", init(pd["d1"]))["contractAddress"]
            elif key == "d2": got[(v, key)] = send("--create", init(pd["d2"]))["contractAddress"]
            elif key == "pos": got[(v, key)] = create("src/PoseidonOpt.sol:PoseidonOpt", str(pd["t"]), str(pd["nrp"]), got[(v, "d1")], got[(v, "d2")], str(pd["len1"]), str(pd["len2"]))
            elif key == "ver": got[(v, key)] = create({"v2": "src/Groth16Verifier.sol:Groth16Verifier", "A": "src/Groth16VerifierA.sol:Groth16VerifierA", "B": "src/Groth16VerifierB.sol:Groth16VerifierB"}[v])
            elif key == "tgt": got[(v, key)] = create("test/Targets.sol:MockTarget")
            elif key == "gate":
                roots = [str(int(f["issuedRoot"], 16)), str(int(f["R0"], 16)), WIN, WIN, SKEW]
                if v == "B": got[(v, key)] = create("src/ZkDacGate.sol:ZkDacGateB", got[(v, "ver")], DEPLOYER, *roots)
                else: got[(v, key)] = create(f"src/ZkDacGate.sol:{'ZkDacGate' if v == 'v2' else 'ZkDacGateA'}", got[(v, "ver")], got[(v, "pos")], DEPLOYER, *roots)
            assert got[(v, key)].lower() == addr[(v, key)].lower(), (v, key, got[(v, key)], addr[(v, key)])
        sig = "execute((uint256[2],uint256[2][2],uint256[2]),uint256,uint256,uint256,uint64,(address,bytes4,uint256,uint256,bytes))"
        for v in ["v2", "A", "B"]:
            f = fx[v]; gate = addr[(v, "gate")]
            send(gate, "setMethod(bytes4,uint32,bool)", f["method"], str(f["reqCap"]), "true")
            def args(i):
                p = f["proofs"][i]
                pr = f'([{p["a"][0]},{p["a"][1]}],[[{p["b"][0][0]},{p["b"][0][1]}],[{p["b"][1][0]},{p["b"][1][1]}]],[{p["c"][0]},{p["c"][1]}])'
                act = f'({addr[(v, "tgt")]},{f["method"]},{p["amount"]},{p["nonce"]},{f["params"]})'
                return [pr, str(int(f["issuedRoot"], 16)), str(int(f["R0"], 16)), str(p["nullifier"]), str(p["now"]), act]
            r1 = send(gate, sig, *args(0)); r2 = send(gate, sig, *args(1))
            def frames(h):   # per-frame gas from the client's own call tracer
                t = json.loads(run(["cast", "rpc", "--rpc-url", rpc, "debug_traceTransaction", h, '{"tracer":"callTracer"}']).stdout)
                out = []
                def walk(n, d):
                    out.append({"depth": d, "type": n.get("type"), "to": n.get("to"), "input4": (n.get("input") or "")[:10], "gas": int(n.get("gas", "0x0"), 16), "gasUsed": int(n.get("gasUsed", "0x0"), 16)})
                    for c in n.get("calls", []) or []: walk(c, d + 1)
                walk(t, 0); return out
            res.setdefault("traces", {})[v] = {"tx1": r1["transactionHash"], "frames1": frames(r1["transactionHash"]), "receipt1": {k: r1.get(k) for k in ["gasUsed", "cumulativeGasUsed", "effectiveGasPrice", "type"]}}
            r3 = send(gate, sig, *args(0), ok=False); r4 = send(gate, sig, *args(2), ok=False)
            res[v] = {"execute_1_gasUsed": int(r1["gasUsed"], 16), "execute_2_gasUsed": int(r2["gasUsed"], 16),
                      "status_1": r1["status"], "status_2": r2["status"], "replay": r3.get("status"), "reqcap0": r4.get("status"),
                      "replay_err": r3.get("err", "")[-60:], "calls": int(run(["cast", "call", "--rpc-url", rpc, addr[(v, "tgt")], "calls()(uint256)"]).stdout.split()[0])}
    finally:
        proc.terminate(); proc.wait()
    return res

gethdir = os.path.join(SCRATCH, "gethdev_e2e"); shutil.rmtree(gethdir, ignore_errors=True)
results = {"now": NOW, "chain_id": CHAIN_ID, "fixtures_sha": {}, "addresses": {f"{v}.{k}": a for (v, k), a in addr.items()}, "runs": []}
# geth --dev genesis as shipped (Osaka + Bogota @0) and the same genesis with bogotaTime removed (Osaka only)
dev_gen = json.loads(run(["geth", "--dev", "dumpgenesis"]).stdout)
results["geth_dev_fork_times"] = {k: v for k, v in dev_gen["config"].items() if k.endswith("Time")}
osaka_gen = json.loads(json.dumps(dev_gen)); del osaka_gen["config"]["bogotaTime"]
osaka_gen["alloc"][DEPLOYER.lower()[2:]] = {"balance": hex(10**24)}
gpath = os.path.join(SCRATCH, "genesis_osaka_only.json"); json.dump(osaka_gen, open(gpath, "w"))
results["genesis_osaka_only_sha256"] = __import__("hashlib").sha256(open(gpath, "rb").read()).hexdigest()
gdir2 = os.path.join(SCRATCH, "gethdev_osaka"); shutil.rmtree(gdir2, ignore_errors=True)
results["runs"].append(client_run("geth --dev, genesis without bogotaTime (Osaka only)",
    ["geth", "--dev", "--datadir", gdir2, "--ipcdisable", "--http", "--http.port", "8548", "--http.api", "eth,net,web3,debug", "--verbosity", "1"],
    "http://127.0.0.1:8548", pre=["geth", "init", "--datadir", gdir2, gpath]))
results["runs"].append(client_run("geth --dev as shipped (Osaka + Bogota)", ["geth", "--dev", "--datadir", gethdir, "--ipcdisable", "--http", "--http.port", "8548", "--http.api", "eth,net,web3,debug", "--verbosity", "1"], "http://127.0.0.1:8548", fund_from="DEV"))
for fork in ["osaka", "cancun"]:
    results["runs"].append(client_run(f"anvil --hardfork {fork}", ["anvil", "--port", "8547", "--chain-id", str(CHAIN_ID), "--hardfork", fork, "--silent"], "http://127.0.0.1:8547"))
import hashlib
for v in fx: results["fixtures_sha"][v] = hashlib.sha256(open(os.path.join(SCRATCH, f"chainfx_{v}.json"), "rb").read()).hexdigest()
print(json.dumps(results, indent=1))
