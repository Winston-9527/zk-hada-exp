# sourced by every repro step: repo root, work dir, log helper
set -euo pipefail
ROOT=$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel); W=$ROOT/work; REPRO=$W/t8_paper/T8-chapter_20261010/repro
OUT=${REPRO_OUT:-$REPRO/out}; mkdir -p "$OUT"
SJ=$W/t2_circuit_fix/zkdac_v7/node_modules/.bin/snarkjs
PTAU=$W/ptau/hermez/powersOfTau28_hez_final_18.ptau
log() { echo "[$(date -u +%H:%M:%S)] $*" | tee -a "$OUT/steps.log"; }
