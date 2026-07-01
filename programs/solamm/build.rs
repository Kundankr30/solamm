// Embed the absolute path to the compiled program into the test binary via
// the `SOLAMM_SO` env var. The path resolves to `<workspace>/target/deploy/solamm.so`
// regardless of where the test is invoked from, and is overridable by
// `SOLAMM_SO=/some/path cargo test`.
//
// Why: `litesvm::add_program_from_file` needs a real on-disk `.so`. We want
// the integration tests to run with plain `cargo test` (no manual copying).

use std::path::PathBuf;

fn main() {
    println!("cargo:rerun-if-env-changed=SOLAMM_SO");
    println!("cargo:rerun-if-changed=build.rs");

    // Honour explicit override first.
    if let Ok(p) = std::env::var("SOLAMM_SO") {
        println!("cargo:rustc-env=SOLAMM_SO={}", p);
        return;
    }

    // Otherwise compute `<workspace>/target/deploy/solamm.so` from
    // CARGO_MANIFEST_DIR (which is `programs/solamm` for this crate).
    // CARGO_MANIFEST_DIR = <workspace>/programs/solamm
    // parent()           = <workspace>/programs
    // parent()           = <workspace>   ← the Anchor workspace root
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let programs_dir = manifest.parent().expect("programs/solamm has a parent (programs/)");
    let workspace = programs_dir.parent().expect("programs/ has a parent (workspace root)");
    let deploy = workspace.join("target").join("deploy").join("solamm.so");

    println!("cargo:rustc-env=SOLAMM_SO={}", deploy.display());
}
