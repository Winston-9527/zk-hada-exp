#!/usr/bin/env python3
"""#18 Part 3 (PREREGISTRATION.md): real receipts for the main gate with authorized revocation (ZkDacGateV7R + ZkDacRevocations), same signed
fixtures and nonce sequence on geth --dev (as shipped; and with bogotaTime removed = Osaka only) and anvil --hardfork osaka / prague / cancun.
Sequence: 2 registrations, execute #1 (valid), execute #1 again (replay, forced into a block), revoke (issuer of hop 2), wait > window,
execute #2 against the retired root (forced). usage: python3 e2e_v7r.py > ../results/e2e_v7r.json   (env SCRATCH = scratch dir)"""
import json, subprocess, time, sys, os, shutil, hashlib
PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"   # anvil's public test account #0 (local chains only)
DEPLOYER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
CHAIN_ID = 1337; SKEW = "3600"; IWIN = "300"; RWIN = 5
HERE = os.path.dirname(os.path.abspath(__file__)); FOUNDRY = os.path.abspath(os.path.join(HERE, "../../../t4_contracts/foundry"))
SCRATCH = os.environ.get("SCRATCH", "/tmp")
P3 = "../node_modules/poseidon-solidity/PoseidonT3.sol:PoseidonT3"

def run(args, cwd=HERE, ok=True, env=None):
    r = subprocess.run(args, capture_output=True, text=True, cwd=cwd, env=env)
    if ok and r.returncode: sys.exit(f"FAILED {' '.join(args)[:240]}\n{r.stdout[-400:]}\n{r.stderr[-800:]}")
    return r

PLAN = ["poseidonT3", "verReg", "registry", "verC4", "verRevoke", "revocations", "target", "gate"]
addr = {k: run(["cast", "compute-address", DEPLOYER, "--nonce", str(n)]).stdout.split()[-1] for n, k in enumerate(PLAN)}
NOW = int(time.time()) - 30
FX = os.path.join(SCRATCH, "e2e_v7r_fixtures.json")
run(["node", "gen_chain_fixtures.mjs"], env=dict(os.environ, NOW=str(NOW), CHAIN=str(CHAIN_ID), GATE=addr["gate"], TARGET=addr["target"], OUT=FX))
fx = json.load(open(FX))
proof = lambda p: f'([{p["a"][0]},{p["a"][1]}],[[{p["b"][0][0]},{p["b"][0][1]}],[{p["b"][1][0]},{p["b"][1][1]}]],[{p["c"][0]},{p["c"][1]}])'
EXEC = "execute((uint256[2],uint256[2][2],uint256[2]),(uint256,uint256,uint256),uint256,uint64,(address,bytes4,uint256,uint256,bytes),uint256[])"

def calldata_cost(inp):
    b = bytes.fromhex(inp[2:]); z = b.count(0); nz = len(b) - z; tokens = z + 4 * nz
    return {"bytes": len(b), "zero": z, "nonzero": nz, "eip2028_calldata_gas": 4 * z + 16 * nz, "eip7623_floor_total": 21000 + 10 * tokens}

def client_run(name, start_cmd, rpc, fund_from=None, pre=None):
    if pre: run(pre)
    proc = subprocess.Popen(start_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        if run(["cast", "chain-id", "--rpc-url", rpc], ok=False).returncode == 0: break
        time.sleep(0.2)
    res = {"client": name}
    for _ in range(100):
        r = run(["cast", "rpc", "--rpc-url", rpc, "eth_getTransactionReceipt", "0x" + "00" * 32], ok=False)
        if "indexing" not in (r.stdout + r.stderr): break
        time.sleep(0.2)
    try:
        res["version"] = run(["cast", "rpc", "--rpc-url", rpc, "web3_clientVersion"]).stdout.strip().strip('"')
        assert int(run(["cast", "chain-id", "--rpc-url", rpc]).stdout) == CHAIN_ID
        if fund_from == "DEV": fund_from = json.loads(run(["cast", "rpc", "--rpc-url", rpc, "eth_accounts"]).stdout)[0]
        def receipt(h):
            for _ in range(150):
                r = run(["cast", "receipt", "--json", "--rpc-url", rpc, h], ok=False)
                if r.returncode == 0 and r.stdout.strip().startswith("{"): return json.loads(r.stdout)
                time.sleep(0.2)
            sys.exit(f"no receipt for {h} on {name}")
        if fund_from: receipt(run(["cast", "send", "--async", "--unlocked", "--from", fund_from, "--value", "1000ether", DEPLOYER, "--rpc-url", rpc]).stdout.strip())
        def send(*a, force=False):
            extra = ["--gas-limit", "3000000"] if force else []     # forced: skip estimation so a failing tx is mined and gives a receipt
            r = run(["cast", "send", "--async", "--private-key", PK, "--rpc-url", rpc, *extra, *a], cwd=FOUNDRY, ok=False)
            if r.returncode != 0: return {"status": "not sent", "err": r.stderr.strip()[-200:]}
            rc = receipt(r.stdout.strip()); rc["_input"] = json.loads(run(["cast", "tx", "--json", "--rpc-url", rpc, rc["transactionHash"]]).stdout)["input"]; return rc
        def create(contract, sig=None, *args, lib=None):
            # forge create misreports deployments on geth --dev at block 0 ("contract was not deployed" although the tx succeeded),
            # so deploy with cast send --create: artifact bytecode, library placeholder linked by hand, constructor args ABI-encoded
            src, name = contract.split(":"); art = json.load(open(os.path.join(FOUNDRY, "out", os.path.basename(src), name + ".json")))
            code = art["bytecode"]["object"]
            if lib: code = __import__("re").sub(r"__\$[0-9a-f]{34}\$__", lib[2:].lower(), code)
            assert "__$" not in code, contract
            if sig: code += run(["cast", "abi-encode", sig, *args]).stdout.strip()[2:]
            r = send("--create", code); assert r.get("status") in ("0x1", 1, "1"), (contract, r.get("status")); return r["contractAddress"]
        got = {}
        got["poseidonT3"] = create(P3)
        got["verReg"] = create("src/Groth16VerifierRegister.sol:Groth16VerifierRegister")
        got["registry"] = create("src/ZkDacRegistry.sol:ZkDacRegistry", "constructor(address,address,uint256,uint64)", got["verReg"], DEPLOYER, fx["domain"], IWIN, lib=got["poseidonT3"])
        got["verC4"] = create("src/Groth16VerifierV7CD4.sol:Groth16VerifierV7CD4")
        got["verRevoke"] = create("src/Groth16VerifierRevoke.sol:Groth16VerifierRevoke")
        got["revocations"] = create("src/ZkDacRevocations.sol:ZkDacRevocations", "constructor(address,uint256,uint256,uint64)", got["verRevoke"], fx["genesisRoot"], str(fx["genesisCount"]), str(RWIN))
        got["target"] = create("test/Targets.sol:MockTarget")
        got["gate"] = create("src/ZkDacGateV7R.sol:ZkDacGateV7R", "constructor(address,address,address,address,uint256,uint64,uint64,uint256[2],uint256)", got["verC4"], got["registry"], got["revocations"], DEPLOYER, fx["issuedRoot"], IWIN, SKEW,
                             f'[{fx["tpk"][0]},{fx["tpk"][1]}]', str(len(fx["actions"][0]["ct"])))
        for k in PLAN: assert got[k].lower() == addr[k].lower(), (k, got[k], addr[k])
        tx = {}
        tx["setGroupRoot"] = send(got["registry"], "setGroupRoot(uint256,bool)", fx["groupRoot"], "true")
        for i, rg in enumerate(fx["regs"]):
            tx[f"register_{i}"] = send(got["registry"], "register((uint256[2],uint256[2][2],uint256[2]),uint256,uint256,uint256,uint256[])", proof(rg), rg["pub"][0], rg["pub"][2], rg["pub"][3], "[]")
        assert int(run(["cast", "call", "--rpc-url", rpc, got["registry"], "currentRoot()(uint256)"]).stdout.split()[0]) == int(fx["rootRoot"])
        tx["setMethod"] = send(got["gate"], "setMethod(bytes4,uint32,bool)", fx["method"], str(fx["reqCap"]), "true")
        def exec_args(a):
            s = a["pub"]; act = f'({got["target"]},{fx["method"]},100,{a["nonce"]},{fx["params"]})'
            return [proof(a), f"({s[0]},{s[1]},{s[2]})", s[3], s[4], act, "[" + ",".join(a["ct"]) + "]"]
        tx["execute_1"] = send(got["gate"], EXEC, *exec_args(fx["actions"][0]))
        tx["execute_1_replay_forced"] = send(got["gate"], EXEC, *exec_args(fx["actions"][0]), force=True)
        rv = fx["revoke"]
        tx["revoke"] = send(got["revocations"], "revoke((uint256[2],uint256[2][2],uint256[2]),uint256,uint256)", proof(rv), rv["newRoot"], rv["entry"])
        res["wall_clock_revoke_sent"] = int(time.time()); time.sleep(RWIN + 2)
        # the window is in BLOCK time: geth --dev stamps each new block parent + 1 s (run 3 showed it can run ahead of the wall clock), so send
        # filler transactions until the latest block is past revoke_block_timestamp + window
        rts = int(json.loads(run(["cast", "block", str(int(tx["revoke"]["blockNumber"], 16)), "--json", "--rpc-url", rpc]).stdout)["timestamp"], 16); fillers = 0
        while int(json.loads(run(["cast", "block", "latest", "--json", "--rpc-url", rpc]).stdout)["timestamp"], 16) <= rts + RWIN:
            send(DEPLOYER, "--value", "1"); fillers += 1
            if fillers > 50: sys.exit("block time does not advance")
        res["filler_txs_after_revoke"] = fillers; res["wall_clock_execute2_sent"] = int(time.time())
        tx["execute_2_after_window_forced"] = send(got["gate"], EXEC, *exec_args(fx["actions"][1]), force=True)
        def frames(h):
            t = json.loads(run(["cast", "rpc", "--rpc-url", rpc, "debug_traceTransaction", h, '{"tracer":"callTracer"}']).stdout); out = []
            def walk(n, d):
                out.append({"depth": d, "type": n.get("type"), "to": n.get("to"), "input4": (n.get("input") or "")[:10], "gasUsed": int(n.get("gasUsed", "0x0"), 16), "error": n.get("error")})
                for c in n.get("calls", []) or []: walk(c, d + 1)
            walk(t, 0); return out
        res["tx"] = {}
        for k, r in tx.items():
            if "transactionHash" not in r: res["tx"][k] = r; continue
            bn = int(r["blockNumber"], 16); ts = int(json.loads(run(["cast", "block", str(bn), "--json", "--rpc-url", rpc]).stdout)["timestamp"], 16)
            e = {"status": r["status"], "gasUsed": int(r["gasUsed"], 16), "logs": len(r.get("logs", [])), "calldata": calldata_cost(r["_input"]), "block": bn, "block_timestamp": ts, "wall_clock_at_report": int(time.time())}
            if k in ("execute_1", "execute_1_replay_forced", "revoke", "execute_2_after_window_forced"): e["frames"] = frames(r["transactionHash"])
            if k.startswith("execute_2") or k.endswith("replay_forced"):
                rr = run(["cast", "call", "--rpc-url", rpc, "--block", str(int(r["blockNumber"], 16) - 1), "--from", DEPLOYER, got["gate"], EXEC,
                          *exec_args(fx["actions"][1] if k.startswith("execute_2") else fx["actions"][0])], cwd=FOUNDRY, ok=False)
                e["revert_reason_at_parent_block"] = (rr.stderr.strip() or rr.stdout.strip())[-160:]
            res["tx"][k] = e
        res["target_calls"] = int(run(["cast", "call", "--rpc-url", rpc, got["target"], "calls()(uint256)"]).stdout.split()[0])
        res["revocations_root_is_newRoot"] = int(run(["cast", "call", "--rpc-url", rpc, got["revocations"], "root()(uint256)"]).stdout.split()[0]) == int(rv["newRoot"])
    finally:
        proc.terminate(); proc.wait()
    return res

results = {"now": NOW, "chain_id": CHAIN_ID, "clock_skew_s": int(SKEW), "revoked_window_s": RWIN, "addresses": addr, "fixtures_sha256": hashlib.sha256(open(FX, "rb").read()).hexdigest(), "runs": []}
shutil.copy(FX, os.path.join(HERE, "../results/e2e_v7r_fixtures.json"))
dev_gen = json.loads(run(["geth", "--dev", "dumpgenesis"]).stdout)
results["geth_dev_fork_times"] = {k: v for k, v in dev_gen["config"].items() if k.endswith("Time")}
osaka_gen = json.loads(json.dumps(dev_gen)); osaka_gen["config"].pop("bogotaTime", None)
osaka_gen["alloc"][DEPLOYER.lower()[2:]] = {"balance": hex(10**24)}
gpath = os.path.join(SCRATCH, "genesis_osaka_only_v7r.json"); json.dump(osaka_gen, open(gpath, "w"))
g1 = os.path.join(SCRATCH, "geth_v7r_osaka"); g2 = os.path.join(SCRATCH, "geth_v7r_shipped")
for d in (g1, g2): shutil.rmtree(d, ignore_errors=True)
GETH = lambda d: ["geth", "--dev", "--datadir", d, "--ipcdisable", "--http", "--http.port", "8549", "--http.api", "eth,net,web3,debug", "--verbosity", "1"]
results["runs"].append(client_run("geth --dev, genesis without bogotaTime (Osaka only)", GETH(g1), "http://127.0.0.1:8549", pre=["geth", "init", "--datadir", g1, gpath]))
results["runs"].append(client_run("geth --dev as shipped", GETH(g2), "http://127.0.0.1:8549", fund_from="DEV"))
for fork in ["osaka", "prague", "cancun"]:
    results["runs"].append(client_run(f"anvil --hardfork {fork}", ["anvil", "--port", "8549", "--chain-id", str(CHAIN_ID), "--hardfork", fork, "--silent"], "http://127.0.0.1:8549"))
print(json.dumps(results, indent=1))
