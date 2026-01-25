// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::{command, State, Manager};
use tauri_plugin_shell::ShellExt;

struct ServerState {
    child: Mutex<Option<tauri_plugin_shell::process::CommandChild>>,
}

#[command]
async fn start_server(
    app: tauri::AppHandle,
    state: State<'_, ServerState>,
    remote: Option<bool>,
) -> Result<String, String> {
    let mut sidecar = app
        .shell()
        .sidecar("voicebox-server")
        .map_err(|e| format!("Failed to get sidecar: {}", e))?;

    if remote.unwrap_or(false) {
        sidecar = sidecar.args(["--host", "0.0.0.0"]);
    }

    let (mut rx, child) = sidecar
        .spawn()
        .map_err(|e| format!("Failed to spawn: {}", e))?;

    // Store child process
    *state.child.lock().unwrap() = Some(child);

    // Wait for server to be ready (listen for startup log)
    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            if let tauri_plugin_shell::process::CommandEvent::Stdout(line) = event {
                if String::from_utf8_lossy(&line).contains("Uvicorn running") {
                    break;
                }
            }
        }
    });

    Ok("Server started on http://localhost:8000".to_string())
}

#[command]
async fn stop_server(state: State<'_, ServerState>) -> Result<(), String> {
    if let Some(child) = state.child.lock().unwrap().take() {
        child.kill().map_err(|e| format!("Failed to kill: {}", e))?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(ServerState {
            child: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![start_server, stop_server])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                // Get all windows and open devtools on the first one
                if let Some((_, window)) = app.webview_windows().iter().next() {
                    window.open_devtools();
                    println!("Dev tools opened");
                } else {
                    println!("No window found to open dev tools");
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
