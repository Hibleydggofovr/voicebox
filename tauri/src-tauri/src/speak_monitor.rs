//! Rust-side subscriber for the backend `/events/speak` SSE stream.
//!
//! Owns the pill-window lifecycle for agent-initiated speech. The dictate
//! webview used to do this itself via `EventSource`, but hidden WebKit
//! windows on macOS throttle long-lived network connections, so speak events
//! never reached the pill. Tauri's event bus, on the other hand, reliably
//! delivers events to hidden webviews (the chord path proves it), so we
//! subscribe here and fan out via `emit`.
//!
//! Flow:
//!   backend speak-start → show dictate window + emit("dictate:speak-start")
//!   backend speak-end   → emit("dictate:speak-end")
//! The pill webview handles the rest (audio playback, then emits
//! `dictate:hide` back to Rust when the audio element's `ended` fires).
//!
//! The task reconnects on any error with a 2 s backoff. There's no fancy
//! exponential backoff — the backend either dies with the app or comes back
//! quickly, and constant 2 s polling is cheap.

use std::time::Duration;

use tauri::{AppHandle, Emitter};

use crate::{ensure_dictate_window, SERVER_PORT};

pub fn spawn_speak_monitor(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        run(app).await;
    });
}

async fn run(app: AppHandle) {
    let url = format!("http://127.0.0.1:{}/events/speak", SERVER_PORT);
    let client = match reqwest::Client::builder().build() {
        Ok(c) => c,
        Err(e) => {
            eprintln!("speak_monitor: failed to build HTTP client: {e}");
            return;
        }
    };
    loop {
        if let Err(e) = stream_once(&client, &url, &app).await {
            eprintln!("speak_monitor: stream err: {e}");
        }
        tokio::time::sleep(Duration::from_secs(2)).await;
    }
}

async fn stream_once(
    client: &reqwest::Client,
    url: &str,
    app: &AppHandle,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut resp = client
        .get(url)
        .header("Accept", "text/event-stream")
        .send()
        .await?;
    if !resp.status().is_success() {
        return Err(format!("speak_monitor: backend returned {}", resp.status()).into());
    }
    let mut buf = String::new();
    while let Some(chunk) = resp.chunk().await? {
        buf.push_str(std::str::from_utf8(&chunk)?);
        // sse-starlette emits CRLF framing; the spec also permits LF, so
        // handle either. Drain whichever separator appears first.
        loop {
            let crlf = buf.find("\r\n\r\n");
            let lf = buf.find("\n\n");
            let (end, sep_len) = match (crlf, lf) {
                (Some(c), Some(l)) if c <= l => (c, 4),
                (Some(c), None) => (c, 4),
                (_, Some(l)) => (l, 2),
                (None, None) => break,
            };
            let frame: String = buf.drain(..end + sep_len).collect();
            if let Some((event, data)) = parse_frame(&frame) {
                dispatch(app, &event, &data);
            }
        }
    }
    Ok(())
}

/// Parse a single SSE frame into (event_name, data_json).
///
/// Returns None for comment-only frames (lines starting with `:`) and
/// for frames without a recognizable `event:` or `data:` line.
fn parse_frame(frame: &str) -> Option<(String, String)> {
    let mut event: Option<String> = None;
    let mut data_lines: Vec<&str> = Vec::new();
    for line in frame.lines() {
        if line.is_empty() || line.starts_with(':') {
            continue;
        }
        if let Some(rest) = line.strip_prefix("event:") {
            event = Some(rest.trim().to_string());
        } else if let Some(rest) = line.strip_prefix("data:") {
            data_lines.push(rest.trim_start());
        }
    }
    let event = event?;
    let data = data_lines.join("\n");
    Some((event, data))
}

fn dispatch(app: &AppHandle, event: &str, data: &str) {
    match event {
        "speak-start" => {
            // Build the pill webview hidden if it doesn't exist yet so its
            // listeners can register — but don't *show* it here. The pill
            // surfaces itself from `audio.onplaying` via `dictate:show`, so
            // users never see the empty-silent generation window.
            ensure_dictate_window(app);
            let _ = app.emit("dictate:speak-start", data.to_string());
        }
        "speak-end" => {
            let _ = app.emit("dictate:speak-end", data.to_string());
        }
        // `ready` and `ping` are heartbeats; ignore.
        _ => {}
    }
}
