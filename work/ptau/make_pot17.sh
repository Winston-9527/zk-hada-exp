#!/usr/bin/env bash
# Dev-only powers of tau 2^17 (one local contribution) for v4 circuits up to 131,072 constraints. NOT a trusted setup.
set -euo pipefail
cd "$(dirname "$0")"; mkdir -p logs
t() { local s=$(date +%s); "$@" >> logs/pot17.log 2>&1; echo "$(date -u +%FT%TZ) $(($(date +%s)-s))s  $*" | cut -c1-140 >> logs/timing.txt; }
echo "start $(date -u +%FT%TZ) snarkjs $(snarkjs --version 2>/dev/null | head -1)" > logs/timing.txt
t snarkjs powersoftau new bn128 17 pot17_0.ptau
t snarkjs powersoftau contribute pot17_0.ptau pot17_1.ptau --name=dev-local -e="$(head -c 32 /dev/urandom | xxd -p)"
t snarkjs powersoftau prepare phase2 pot17_1.ptau pot17_final.ptau
rm -f pot17_0.ptau pot17_1.ptau
t snarkjs powersoftau verify pot17_final.ptau
grep -q "Powers of Tau Ok" logs/pot17.log && echo "verify OK" >> logs/timing.txt || echo "verify FAILED" >> logs/timing.txt
shasum -a 256 pot17_final.ptau >> logs/timing.txt
echo DONE >> logs/timing.txt
