#!/bin/bash
# zkey for note_transfer (Hermez 2^18 phase 1; ONE local phase-2 contribution: not a trusted setup)
set -euo pipefail
cd "$(dirname "$0")"
SJ=../../t2_circuit_fix/zkdac_v7/node_modules/.bin/snarkjs; PTAU=../../ptau/hermez/powersOfTau28_hez_final_18.ptau
mkdir -p build/zk zk
$SJ groth16 setup build/note_transfer.r1cs $PTAU build/zk/nt_0.zkey > build/zk/setup.log
$SJ zkey contribute build/zk/nt_0.zkey build/zk/nt.zkey --name="h3-local" -e="$(head -c 32 /dev/urandom | xxd -p -c 64)" >> build/zk/setup.log
$SJ zkey verify build/note_transfer.r1cs $PTAU build/zk/nt.zkey >> build/zk/setup.log
$SJ zkey export verificationkey build/zk/nt.zkey zk/vk_nt.json
$SJ zkey export solidityverifier build/zk/nt.zkey zk/Groth16VerifierNote.sol
sed -i '' 's/contract Groth16Verifier /contract Groth16VerifierNote /' zk/Groth16VerifierNote.sol
rm build/zk/nt_0.zkey
shasum -a 256 build/note_transfer.r1cs build/note_transfer_js/note_transfer.wasm build/zk/nt.zkey zk/vk_nt.json zk/Groth16VerifierNote.sol > zk/MANIFEST.sha256
