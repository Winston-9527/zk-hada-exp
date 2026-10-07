#!/usr/bin/env python3
"""usage: gen_input.py DEPTH SEED OUT.json  -- valid chain input via the historical generator."""
import json, sys
import harness_hist as h
d, seed, out = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
json.dump(h.generate_chain(seed, depth=d), open(out, "w"), indent=2, sort_keys=True)
