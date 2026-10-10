// T6 wrapper (not part of upstream): runs ONLY the upstream microbench group, unchanged, without the passport group (which needs a real US passport dump).
use criterion::criterion_main;
mod microbenches;
mod util;
use microbenches::microbenches;
use util::new_size_file as setup;
criterion_main!(setup, microbenches);   // same form as upstream benches/bench.rs
