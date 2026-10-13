#!/bin/bash
# T8b step 0: tool versions and binary hashes; C0 = frozen circuit sources identical to tag v9.1-freeze-20261013
source "$(dirname "$0")/common.sh"
{ uname -a; (cat /etc/os-release 2>/dev/null | head -2) || true; sw_vers 2>/dev/null || true
  (lscpu 2>/dev/null | grep -E "Model name|^CPU\(s\)") || sysctl -n machdep.cpu.brand_string 2>/dev/null || true
  echo "node $(node -v)"; echo "npm $(npm -v)"; circom --version; forge --version | head -1; anvil --version | head -1; python3 --version
  for b in node circom forge anvil; do sha "$(command -v $b)"; done
  echo "git HEAD $(git -C "$ROOT" rev-parse HEAD)"; echo "freeze tag $(git -C "$ROOT" rev-parse v9.1-freeze-20261013^{commit})"; } > "$OUT/env.txt" 2>&1
cat "$OUT/env.txt"
if git -C "$ROOT" diff --quiet v9.1-freeze-20261013 HEAD -- work/t2_circuit_fix/zkdac_v9_1/circuits work/t2_circuit_fix/zkdac_v9/circuits work/t2_circuit_fix/zkdac_v7/circuits work/t2_circuit_fix/zkdac_v8/circuits; then
  log "C0 ok: frozen circuit sources identical to v9.1-freeze-20261013"; echo "C0 ok" > "$OUT/C0.txt"; else log "C0 FAIL"; echo "C0 FAIL" > "$OUT/C0.txt"; exit 1; fi
