#!/usr/bin/env python3
"""E7 on a local anvil chain: deploy everything, send real execute txs, read gasUsed from receipts.
usage: GATE/TARGET fixed by deployer nonce -> run gen_fixtures with OUT=anvil_fixtures.json first (see RUN_RECORD)."""
import json, subprocess, time, sys, os
RPC = "http://127.0.0.1:8547"
PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"   # anvil's public test account #0 (local only)
OP = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
fx = json.load(open("anvil_fixtures.json"))
def sh(*a, ok=True):
    r = subprocess.run(list(a), capture_output=True, text=True, cwd="foundry")
    if ok and r.returncode: sys.exit(f"FAILED {' '.join(a)[:200]}\n{r.stderr[-800:]}")
    return r
def send(*a, ok=True):
    r = sh("cast", "send", "--json", "--private-key", PK, "--rpc-url", RPC, *a, ok=ok)
    return json.loads(r.stdout) if r.returncode == 0 else {"status": "revert", "err": r.stderr.strip()[-300:]}
def create(contract, *args):
    r = sh("forge", "create", contract, "--json", "--broadcast", "--private-key", PK, "--rpc-url", RPC, *(["--constructor-args", *args] if args else []))
    return json.loads(r.stdout)["deployedTo"]
def init(rt):  # PUSH2 len DUP1 PUSH1 0x0c PUSH1 0 CODECOPY PUSH1 0 RETURN || runtime
    n = (len(rt) - 2) // 2; return "0x61" + format(n, "04x") + "80600c6000396000f3" + rt[2:]
anvil = subprocess.Popen(["anvil", "--port", "8547", "--timestamp", str(fx["now"] - 100), "--silent", "--hardfork", "cancun"])
time.sleep(1.5)
out = {"chain": "anvil 1.5.1 local, hardfork cancun, chainid 31337", "now": fx["now"]}
try:
    d1 = send("--create", init(fx["poseidonData"]["d1"]))["contractAddress"]
    d2 = send("--create", init(fx["poseidonData"]["d2"]))["contractAddress"]
    pos = create("src/PoseidonT8.sol:PoseidonT8", d1, d2, str(fx["poseidonData"]["len1"]), str(fx["poseidonData"]["len2"]))
    ver = create("src/Groth16Verifier.sol:Groth16Verifier")
    tgt = create("test/Targets.sol:MockTarget")
    gate = create("src/ZkDacGate.sol:ZkDacGate", ver, pos, OP, str(int(fx["issuedRoot"], 16)), str(int(fx["R0"], 16)), "300", "300", "60")
    assert gate.lower() == fx["gate"].lower() and tgt.lower() == fx["target"].lower(), (gate, tgt)
    send(gate, "setMethod(bytes4,uint32,bool)", fx["method"], str(fx["reqCap"]), "true")
    sig = "execute((uint256[2],uint256[2][2],uint256[2]),uint256,uint256,uint256,uint64,(address,bytes4,uint256,uint256,bytes))"
    def args(i):
        p = fx["proofs"][i]; s = p["pub"]
        pr = f'([{p["a"][0]},{p["a"][1]}],[[{p["b"][0][0]},{p["b"][0][1]}],[{p["b"][1][0]},{p["b"][1][1]}]],[{p["c"][0]},{p["c"][1]}])'
        act = f'({tgt},{fx["method"]},{p["amount"]},{p["nonce"]},{fx["params"]})'
        return [pr, s[0], s[1], s[3], str(int(s[4], 16)), act]
    sh("cast", "rpc", "--rpc-url", RPC, "evm_setNextBlockTimestamp", str(fx["now"] + 5))
    r1 = send(gate, sig, *args(0)); out["execute_first_gasUsed"] = int(r1["gasUsed"], 16)
    r2 = send(gate, sig, *args(1)); out["execute_second_gasUsed"] = int(r2["gasUsed"], 16)
    r3 = send(gate, sig, *args(0), ok=False); out["replay_status"] = r3.get("status"); out["replay_err"] = r3.get("err", "")[-120:]
    r4 = send(gate, sig, *args(2), ok=False); out["reqcap0_status"] = r4.get("status")
    p = fx["proofs"][0]; s = p["pub"]
    vargs = [f'[{p["a"][0]},{p["a"][1]}]', f'[[{p["b"][0][0]},{p["b"][0][1]}],[{p["b"][1][0]},{p["b"][1][1]}]]', f'[{p["c"][0]},{p["c"][1]}]', "[" + ",".join(s[:2] + [hex(int(s[2], 16))] + s[3:]) + "]"]
    out["verifyProof_returns"] = sh("cast", "call", "--rpc-url", RPC, ver, "verifyProof(uint256[2],uint256[2][2],uint256[2],uint256[5])(bool)", *vargs).stdout.strip()
    # NOTE: no eth_estimateGas for verifyProof: the snarkjs verifier returns false (no revert) when the pairing
    # precompile runs out of gas, so estimation converges to a meaningless low value. Use forge's gasleft() figure.
    out["poseidon7_estimate_tx"] = int(sh("cast", "estimate", "--rpc-url", RPC, pos, "poseidon(uint256[7])", "[1,2,3,4,5,6,7]").stdout)
    out["target_calls"] = int(sh("cast", "call", "--rpc-url", RPC, tgt, "calls()(uint256)").stdout.split()[0])
    out["addresses"] = {"gate": gate, "verifier": ver, "poseidon": pos, "target": tgt, "data1": d1, "data2": d2}
finally:
    anvil.terminate()
print(json.dumps(out, indent=1))
