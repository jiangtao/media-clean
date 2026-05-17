mod app;
mod core_adapter;
mod filesystem;
mod media_probe;
mod model;
mod report;

fn main() {
    if let Err(error) = app::run() {
        eprintln!("mc error: {error:#}");
        std::process::exit(1);
    }
}
