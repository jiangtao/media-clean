fn main() {
    if let Err(error) = mc_cli::app::run() {
        eprintln!("mc error: {error:#}");
        std::process::exit(1);
    }
}
