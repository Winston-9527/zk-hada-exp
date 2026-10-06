import json, subprocess, sys
B, base = sys.argv[1], sys.argv[2]
b = json.load(open(base))
def ev(name, d):
    json.dump(d, open(f"{B}/{name}.json", "w"))
    r = subprocess.run(["node", f"{B}/committed_js/generate_witness.js", f"{B}/committed_js/committed.wasm", f"{B}/{name}.json", f"{B}/{name}.wtns"], capture_output=True, text=True)
    print(f"{name}: {'WITNESS_ACCEPTED' if r.returncode == 0 else 'rejected'}")
v = dict(b)
for k in range(4): v[f"eddsa_enabled_{k}"] = v[f"merkle_enabled_{k}"] = v[f"rev_enabled_{k}"] = "1"
ev("A_valid_all_switches_1", v)
f = dict(v); f["sig0_S"] = str(int(f["sig0_S"]) + 1); ev("B_forged_sig_switches_1", f)
for k in range(4): f[f"eddsa_enabled_{k}"] = "0"
ev("C_forged_sig_eddsa_switch_0", f)
g = dict(f)
for k in range(4): g[f"merkle_enabled_{k}"] = g[f"rev_enabled_{k}"] = "0"
g["issued_root"], g["revoked_root"] = "12345", "999"
ev("D_all_switches_0_fake_roots", g)
