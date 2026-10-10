# Run record: T8 (#10)
Date 2026-10-10. Apple M5 Pro, macOS 26.4; tool versions in cleanbuild/attempt3_out/env.txt. matplotlib 3.9.2 / numpy 2.1.1 / pymupdf (preview render) in
a uv venv (`.venv`, git-ignored); TeX Live (latexmk) for preview.pdf.
Commands: `python3 make_numbers.py`; `.venv/bin/python figures/make_figures.py`; `latexmk -pdf preview.tex`;
release: ~/Developer/zk-hada-exp-release-staging/upload.sh (create, upload with retries, re-download, `shasum -c`: 16/16 OK);
clean build: fresh clone + `repro/00_env.sh … 50_core.sh` (three attempts, see RESULTS.md; logs in cleanbuild/).
Seeds: none new (the re-run scripts use their recorded seeds).
