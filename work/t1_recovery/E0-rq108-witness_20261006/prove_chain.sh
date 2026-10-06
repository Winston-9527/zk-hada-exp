#!/usr/bin/env bash
# source -> r1cs -> witness -> zkey/vk -> proof -> verify for historical RQ108. Needs ../E0-rq108-rebuild_20261006/build (run rebuild.sh first).
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd); R="$HERE/../E0-rq108-rebuild_20261006/build/out"; B="$HERE/build"; mkdir -p "$B"; cd "$B"
PTAU_POW=${PTAU_POW:-16}
[ -f pot.ptau ] || { snarkjs powersoftau new bn128 $PTAU_POW p0.ptau -v >/dev/null; snarkjs powersoftau contribute p0.ptau p1.ptau --name=dev -e="$(head -c 32 /dev/urandom | xxd -p)" >/dev/null; snarkjs powersoftau prepare phase2 p1.ptau pot.ptau >/dev/null; rm p0.ptau p1.ptau; }
[ -f circuit.zkey ] || { snarkjs groth16 setup "$R/rq108_fixed.r1cs" pot.ptau c0.zkey >/dev/null
snarkjs zkey contribute c0.zkey circuit.zkey --name=dev -e="$(head -c 32 /dev/urandom | xxd -p)" >/dev/null; rm c0.zkey; }
snarkjs zkey export verificationkey circuit.zkey vk.json >/dev/null
for D in 4 2; do
  python3 "$HERE/gen_input.py" $D 0 input_d$D.json
  node "$R/rq108_fixed_js/generate_witness.js" "$R/rq108_fixed_js/rq108_fixed.wasm" input_d$D.json w_d$D.wtns && echo "witness d=$D OK"
  /usr/bin/time -p snarkjs groth16 prove circuit.zkey w_d$D.wtns proof_d$D.json public_d$D.json 2> time_d$D.txt
  snarkjs groth16 verify vk.json public_d$D.json proof_d$D.json
done
shasum -a 256 "$R/rq108_fixed.r1cs" circuit.zkey vk.json proof_d4.json public_d4.json input_d4.json w_d4.wtns | tee MANIFEST.sha256
