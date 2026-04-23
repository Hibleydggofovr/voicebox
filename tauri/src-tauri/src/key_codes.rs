//! Stable string ↔ `rdev::Key` mapping for chord persistence.
//!
//! The frontend captures keypresses through the browser keyboard API (which
//! exposes `event.code` like `"MetaRight"`, `"AltRight"`, `"Space"`, `"KeyA"`)
//! and stores chords in capture_settings as JSON arrays of canonical names.
//! On the way back the same names need to round-trip into `rdev::Key`
//! variants the chord engine actually matches against.
//!
//! Names follow the rdev variant identifiers exactly (`"MetaRight"`,
//! `"AltGr"`, `"KeyA"`, …) with one alias: the browser reports right-Option
//! as `"AltRight"` while rdev calls it `"AltGr"`. Both map to the same key.

use rdev::Key;

/// Resolve a canonical key name to its `rdev::Key`. Returns `None` for
/// names that don't have a corresponding variant — the command surface
/// rejects those so we never silently drop keys from a chord.
pub fn key_from_str(name: &str) -> Option<Key> {
    Some(match name {
        // Modifiers — left/right distinction matters for chord defaults.
        "Alt" | "AltLeft" => Key::Alt,
        "AltGr" | "AltRight" => Key::AltGr,
        "ControlLeft" => Key::ControlLeft,
        "ControlRight" => Key::ControlRight,
        "MetaLeft" => Key::MetaLeft,
        "MetaRight" => Key::MetaRight,
        "ShiftLeft" => Key::ShiftLeft,
        "ShiftRight" => Key::ShiftRight,
        "CapsLock" => Key::CapsLock,
        "Function" => Key::Function,

        // Whitespace / navigation
        "Space" => Key::Space,
        "Tab" => Key::Tab,
        "Return" | "Enter" => Key::Return,
        "Backspace" => Key::Backspace,
        "Delete" => Key::Delete,
        "Escape" => Key::Escape,
        "Insert" => Key::Insert,
        "Home" => Key::Home,
        "End" => Key::End,
        "PageUp" => Key::PageUp,
        "PageDown" => Key::PageDown,
        "ArrowUp" | "UpArrow" => Key::UpArrow,
        "ArrowDown" | "DownArrow" => Key::DownArrow,
        "ArrowLeft" | "LeftArrow" => Key::LeftArrow,
        "ArrowRight" | "RightArrow" => Key::RightArrow,

        // Function row
        "F1" => Key::F1, "F2" => Key::F2, "F3" => Key::F3, "F4" => Key::F4,
        "F5" => Key::F5, "F6" => Key::F6, "F7" => Key::F7, "F8" => Key::F8,
        "F9" => Key::F9, "F10" => Key::F10, "F11" => Key::F11, "F12" => Key::F12,

        // Digits
        "Digit0" | "Num0" => Key::Num0,
        "Digit1" | "Num1" => Key::Num1,
        "Digit2" | "Num2" => Key::Num2,
        "Digit3" | "Num3" => Key::Num3,
        "Digit4" | "Num4" => Key::Num4,
        "Digit5" | "Num5" => Key::Num5,
        "Digit6" | "Num6" => Key::Num6,
        "Digit7" | "Num7" => Key::Num7,
        "Digit8" | "Num8" => Key::Num8,
        "Digit9" | "Num9" => Key::Num9,

        // Letters — browser uses "KeyA" style which already matches rdev.
        "KeyA" => Key::KeyA, "KeyB" => Key::KeyB, "KeyC" => Key::KeyC,
        "KeyD" => Key::KeyD, "KeyE" => Key::KeyE, "KeyF" => Key::KeyF,
        "KeyG" => Key::KeyG, "KeyH" => Key::KeyH, "KeyI" => Key::KeyI,
        "KeyJ" => Key::KeyJ, "KeyK" => Key::KeyK, "KeyL" => Key::KeyL,
        "KeyM" => Key::KeyM, "KeyN" => Key::KeyN, "KeyO" => Key::KeyO,
        "KeyP" => Key::KeyP, "KeyQ" => Key::KeyQ, "KeyR" => Key::KeyR,
        "KeyS" => Key::KeyS, "KeyT" => Key::KeyT, "KeyU" => Key::KeyU,
        "KeyV" => Key::KeyV, "KeyW" => Key::KeyW, "KeyX" => Key::KeyX,
        "KeyY" => Key::KeyY, "KeyZ" => Key::KeyZ,

        // Punctuation / symbols
        "Backquote" | "BackQuote" => Key::BackQuote,
        "Minus" => Key::Minus,
        "Equal" => Key::Equal,
        "BracketLeft" | "LeftBracket" => Key::LeftBracket,
        "BracketRight" | "RightBracket" => Key::RightBracket,
        "Semicolon" | "SemiColon" => Key::SemiColon,
        "Quote" => Key::Quote,
        "Backslash" | "BackSlash" => Key::BackSlash,
        "Comma" => Key::Comma,
        "Period" | "Dot" => Key::Dot,
        "Slash" => Key::Slash,

        _ => return None,
    })
}
