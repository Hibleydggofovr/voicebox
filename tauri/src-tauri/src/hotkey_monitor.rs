//! Global keyboard tap + chord dispatcher.
//!
//! Spawns a dedicated thread running `rdev::listen` (which internally owns a
//! CGEventTap on macOS / `SetWindowsHookEx` on Windows / `XRecord` on Linux).
//! Feeds raw key events into a private `Chord` state machine and translates
//! its effects into Tauri events + window show/hide calls.
//!
//! Left- and right-hand modifier variants are deliberately kept distinct.
//! Defaults bind to right-hand Cmd + right-hand Option so that the usual
//! left-hand shortcuts — Cmd+Option+I to open devtools, Cmd+Option+Esc for
//! force-quit, etc. — continue to work untouched.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use std::thread;

use rdev::{listen, EventType, Key};
use tauri::{AppHandle, Emitter, Manager};

use crate::focus_capture;
use crate::DICTATE_WINDOW_LABEL;

// ========================================================================
// Chord state machine
// ========================================================================

/// Semantic action a chord can be bound to. `PushToTalk` = hold chord to
/// record, release to stop. `ToggleToTalk` = press chord to start recording,
/// press again to stop.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ChordAction {
    PushToTalk,
    ToggleToTalk,
}

/// Output of the chord state machine after consuming an input event. Hosts
/// translate these into UI / recorder calls.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Effect {
    StartRecording(ChordAction),
    StopRecording(ChordAction),
    /// Emitted when a push-to-talk chord is "upgraded" into the toggle chord
    /// mid-hold — hosts may want to discard the captured audio and restart
    /// so the transition moment isn't in the recording.
    RestartRecording(ChordAction),
}

#[derive(Debug, Clone)]
enum KeyEvent {
    Down(Key),
    Up(Key),
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Match {
    None,
    Partial,
    Hit(ChordAction),
}

pub type Bindings = HashMap<ChordAction, HashSet<Key>>;

/// Private state machine that turns key-down / key-up events into
/// `Effect`s. Owns no I/O — just the "which keys are held" and
/// "which action is currently driving a recording" bookkeeping.
struct Chord {
    bindings: Bindings,
    pressed_keys: HashSet<Key>,
    active_recording_action: Option<ChordAction>,
}

impl Chord {
    fn new(bindings: Bindings) -> Self {
        Self {
            bindings,
            pressed_keys: HashSet::new(),
            active_recording_action: None,
        }
    }

    fn update_bindings(&mut self, bindings: Bindings) {
        self.bindings = bindings;
    }

    fn handle(&mut self, event: KeyEvent) -> Vec<Effect> {
        let changed = match event {
            KeyEvent::Down(k) => self.pressed_keys.insert(k),
            KeyEvent::Up(k) => self.pressed_keys.remove(&k),
        };
        if !changed {
            return Vec::new();
        }
        self.step()
    }

    #[allow(dead_code)] // Used by the chord picker UI in Pass 2 to suspend matching during capture.
    fn reset(&mut self) {
        self.pressed_keys.clear();
        self.active_recording_action = None;
    }

    fn step(&mut self) -> Vec<Effect> {
        match self.active_recording_action {
            Some(ChordAction::PushToTalk) => {
                if self.classify() == Match::Hit(ChordAction::ToggleToTalk) {
                    self.active_recording_action = Some(ChordAction::ToggleToTalk);
                    return vec![Effect::RestartRecording(ChordAction::ToggleToTalk)];
                }

                let still_held = self
                    .bindings
                    .get(&ChordAction::PushToTalk)
                    .map(|chord| chord.is_subset(&self.pressed_keys))
                    .unwrap_or(false);

                if !still_held {
                    self.active_recording_action = None;
                    return vec![Effect::StopRecording(ChordAction::PushToTalk)];
                }
                Vec::new()
            }
            Some(ChordAction::ToggleToTalk) => {
                if self.classify() == Match::Hit(ChordAction::ToggleToTalk) {
                    self.active_recording_action = None;
                    return vec![Effect::StopRecording(ChordAction::ToggleToTalk)];
                }
                Vec::new()
            }
            None => match self.classify() {
                Match::Hit(action) => {
                    self.active_recording_action = Some(action);
                    vec![Effect::StartRecording(action)]
                }
                Match::None | Match::Partial => Vec::new(),
            },
        }
    }

    fn classify(&self) -> Match {
        if self.pressed_keys.is_empty() {
            return Match::None;
        }

        // Exact match wins even if the pressed set is also a prefix of another
        // binding.
        for (action, chord) in &self.bindings {
            if self.pressed_keys == *chord {
                return Match::Hit(*action);
            }
        }

        let is_prefix = self
            .bindings
            .values()
            .any(|c| self.pressed_keys.is_subset(c) && self.pressed_keys != *c);

        if is_prefix {
            Match::Partial
        } else {
            Match::None
        }
    }
}

// ========================================================================
// Monitor
// ========================================================================

/// Hardcoded Pass 1 defaults. Two right-hand modifiers so the usual left-hand
/// shortcuts pass through unaffected. Replaced in Pass 2 by reading from the
/// server-side `capture_settings` table via a Tauri command the frontend
/// invokes whenever `useCaptureSettings` resolves.
///
/// - **macOS:** `MetaRight + AltGr` — right Command + right Option. (rdev
///   labels right-Option as `AltGr` for Linux-convention symmetry; on macOS
///   it's the physical right-option key.)
/// - **Windows / Linux:** `ControlRight + ShiftRight` — right Ctrl + right
///   Shift. Deliberately avoids `AltGr`: on international Windows layouts
///   the OS synthesises `AltGr` as `Ctrl+Alt`, so any `AltGr`-involving
///   default would fire on every `@`, `€`, `\` keypress on German / French
///   / Spanish keyboards.
pub fn default_bindings() -> Bindings {
    #[cfg(target_os = "macos")]
    let (m1, m2) = (Key::MetaRight, Key::AltGr);
    #[cfg(not(target_os = "macos"))]
    let (m1, m2) = (Key::ControlRight, Key::ShiftRight);

    let mut b = Bindings::new();
    b.insert(ChordAction::PushToTalk, {
        let mut s = HashSet::new();
        s.insert(m1);
        s.insert(m2);
        s
    });
    b.insert(ChordAction::ToggleToTalk, {
        let mut s = HashSet::new();
        s.insert(m1);
        s.insert(m2);
        s.insert(Key::Space);
        s
    });
    b
}

pub struct HotkeyMonitor {
    chord: Arc<Mutex<Chord>>,
}

impl HotkeyMonitor {
    pub fn spawn(app: AppHandle, bindings: Bindings) -> Self {
        let chord = Arc::new(Mutex::new(Chord::new(bindings)));
        let chord_for_thread = chord.clone();
        let app_for_thread = app.clone();

        thread::spawn(move || {
            // Without this call, rdev's convert() calls TSMGetInputSourceProperty
            // on this background thread, which trips a main-queue assertion on
            // macOS 14+ and traps the whole process (see Narsil/rdev#165 / #147).
            #[cfg(target_os = "macos")]
            rdev::set_is_main_thread(false);

            let result = listen(move |event| {
                let input = match event.event_type {
                    EventType::KeyPress(k) => KeyEvent::Down(k),
                    EventType::KeyRelease(k) => KeyEvent::Up(k),
                    _ => return,
                };

                let effects = match chord_for_thread.lock() {
                    Ok(mut chord) => chord.handle(input),
                    Err(_) => return,
                };

                for effect in effects {
                    apply_effect(&app_for_thread, effect);
                }
            });

            if let Err(err) = result {
                eprintln!(
                    "HotkeyMonitor: rdev::listen failed ({:?}). Global chord detection is disabled. On macOS, grant Input Monitoring in System Settings → Privacy & Security → Input Monitoring and relaunch.",
                    err
                );
            }
        });

        Self { chord }
    }

    pub fn update_bindings(&self, bindings: Bindings) {
        if let Ok(mut chord) = self.chord.lock() {
            chord.update_bindings(bindings);
        }
    }
}

fn apply_effect(app: &AppHandle, effect: Effect) {
    match effect {
        Effect::StartRecording(_) => {
            // Snapshot focus BEFORE we touch the window — any AppKit
            // reshuffle triggered by set_position / show could in principle
            // steal key focus and poison the reading. In practice those
            // calls leave keyWindow alone, but capturing first is free.
            let focus = focus_capture::capture_focus().ok();

            if let Some(window) = app.get_webview_window(DICTATE_WINDOW_LABEL) {
                // The previous hide-cycle parked the window off-screen and
                // made it click-through — undo both before showing, so the
                // pill lands at top-center and the user can actually click
                // the error pill / stop button.
                //
                // `current_monitor()` returns None when the window is off
                // any display (our hide handler parks it at -10_000, -10_000
                // precisely so it never intercepts clicks), so fall back to
                // the primary monitor for the reposition.
                let monitor = window
                    .current_monitor()
                    .ok()
                    .flatten()
                    .or_else(|| window.primary_monitor().ok().flatten());
                if let Some(monitor) = monitor {
                    let monitor_pos = monitor.position();
                    let monitor_size = monitor.size();
                    if let Ok(win_size) = window.outer_size() {
                        let x = monitor_pos.x
                            + (monitor_size.width as i32 - win_size.width as i32) / 2;
                        let y = monitor_pos.y + (monitor_size.height as f64 * 0.04) as i32;
                        let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
                    }
                }
                let _ = window.set_ignore_cursor_events(false);
                // Deliberately no set_focus() — taking key focus would yank
                // it out of whatever app the user was typing in, which is
                // the opposite of what a dictation overlay should do.
                let _ = window.show();
                let payload = serde_json::json!({ "focus": focus });
                let _ = window.emit("dictate:start", payload);
            }
        }
        Effect::StopRecording(_) => {
            if let Some(window) = app.get_webview_window(DICTATE_WINDOW_LABEL) {
                let _ = window.emit("dictate:stop", ());
            }
        }
        Effect::RestartRecording(_) => {
            if let Some(window) = app.get_webview_window(DICTATE_WINDOW_LABEL) {
                let _ = window.emit("dictate:restart", ());
            }
        }
    }
}

// ========================================================================
// Tests
// ========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn keys(keys: &[Key]) -> HashSet<Key> {
        keys.iter().copied().collect()
    }

    fn test_bindings() -> Bindings {
        let mut b = Bindings::new();
        b.insert(ChordAction::PushToTalk, keys(&[Key::MetaLeft, Key::Alt]));
        b.insert(
            ChordAction::ToggleToTalk,
            keys(&[Key::MetaLeft, Key::Alt, Key::Space]),
        );
        b
    }

    #[test]
    fn push_to_talk_starts_on_exact_hold_and_stops_on_release() {
        let mut c = Chord::new(test_bindings());
        assert_eq!(c.handle(KeyEvent::Down(Key::MetaLeft)), vec![]);
        assert_eq!(
            c.handle(KeyEvent::Down(Key::Alt)),
            vec![Effect::StartRecording(ChordAction::PushToTalk)],
        );
        assert_eq!(
            c.handle(KeyEvent::Up(Key::Alt)),
            vec![Effect::StopRecording(ChordAction::PushToTalk)],
        );
    }

    #[test]
    fn toggle_starts_on_exact_and_stops_on_second_exact() {
        let mut c = Chord::new(test_bindings());
        c.handle(KeyEvent::Down(Key::MetaLeft));
        c.handle(KeyEvent::Down(Key::Alt));
        // At this point PTT is active.
        assert_eq!(c.active_recording_action, Some(ChordAction::PushToTalk));
        assert_eq!(
            c.handle(KeyEvent::Down(Key::Space)),
            vec![Effect::RestartRecording(ChordAction::ToggleToTalk)],
        );
        // Releasing cmd/opt must not stop toggle recording.
        assert_eq!(c.handle(KeyEvent::Up(Key::MetaLeft)), vec![]);
        assert_eq!(c.handle(KeyEvent::Up(Key::Alt)), vec![]);
        assert_eq!(c.handle(KeyEvent::Up(Key::Space)), vec![]);

        // Second press of toggle chord stops it.
        c.handle(KeyEvent::Down(Key::MetaLeft));
        c.handle(KeyEvent::Down(Key::Alt));
        assert_eq!(
            c.handle(KeyEvent::Down(Key::Space)),
            vec![Effect::StopRecording(ChordAction::ToggleToTalk)],
        );
    }

    #[test]
    fn toggle_from_idle_starts_immediately_on_full_chord() {
        let mut c = Chord::new(test_bindings());
        c.handle(KeyEvent::Down(Key::MetaLeft));
        c.handle(KeyEvent::Down(Key::Alt));
        // Drop MetaLeft before Space — we're not in the exact toggle match
        // yet, just prefix. No start for toggle.
        assert_eq!(c.active_recording_action, Some(ChordAction::PushToTalk));
    }
}
