//! Synthetic keyboard event posting for the auto-paste pipeline.
//!
//! `send_paste` fires the four-event paste sequence onto the OS input
//! pipeline so the focused app performs its native paste action against
//! whatever the clipboard module has just staged.
//!
//! - **macOS** — Cmd down, V down with Cmd flag, V up with Cmd flag, Cmd
//!   up via `CGEventPost` at `kCGHIDEventTap`. Accessibility permission is
//!   load-bearing: without it the system swallows the events silently, so
//!   callers must gate on [`crate::accessibility::is_trusted`].
//! - **Windows** — Ctrl down, V down, V up, Ctrl up via `SendInput`. No
//!   permission gate, but UAC/UIPI blocks delivery into elevated target
//!   windows when we run non-elevated — nothing we can do short of also
//!   running elevated.
//!
//! The virtual keycode used for V is `kVK_ANSI_V` (9) on macOS and `VK_V`
//! (0x56) on Windows. Both are layout-dependent — they mean "the physical
//! key in the QWERTY V position" — so on Dvorak / Colemak this would fire
//! the wrong shortcut. A later pass will resolve the current layout's V
//! keycode per-platform (`TISCopyCurrentKeyboardInputSource` +
//! `UCKeyTranslate` on macOS; `VkKeyScanExW` on Windows).

#[cfg(target_os = "macos")]
use std::ffi::c_void;

#[cfg(target_os = "macos")]
mod ffi {
    use std::ffi::c_void;

    #[repr(C)]
    pub struct CGEvent {
        _opaque: [u8; 0],
    }
    pub type CGEventRef = *mut CGEvent;

    #[repr(C)]
    pub struct CGEventSource {
        _opaque: [u8; 0],
    }
    pub type CGEventSourceRef = *mut CGEventSource;

    pub type CGEventTapLocation = u32;
    pub type CGKeyCode = u16;
    pub type CGEventFlags = u64;
    pub type CGEventSourceStateID = i32;

    /// `kCGHIDEventTap` — posted events enter at the HID level so every
    /// downstream tap (including the target app) sees them exactly as if the
    /// hardware had produced them.
    pub const K_CG_HID_EVENT_TAP: CGEventTapLocation = 0;

    /// `kCGEventSourceStateHIDSystemState` — mimics hardware, which is what
    /// we want: modifier bookkeeping inside target apps stays consistent.
    pub const K_CG_EVENT_SOURCE_STATE_HID_SYSTEM_STATE: CGEventSourceStateID = 1;

    /// `kCGEventFlagMaskCommand` — the Cmd modifier bit inside `CGEventFlags`.
    pub const K_CG_EVENT_FLAG_MASK_COMMAND: CGEventFlags = 0x00100000;

    /// `kVK_ANSI_V`.
    pub const KEYCODE_V: CGKeyCode = 9;
    /// `kVK_Command` (left Cmd).
    pub const KEYCODE_LEFT_CMD: CGKeyCode = 0x37;

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        pub fn CGEventSourceCreate(state_id: CGEventSourceStateID) -> CGEventSourceRef;
        pub fn CGEventCreateKeyboardEvent(
            source: CGEventSourceRef,
            virtual_key: CGKeyCode,
            key_down: bool,
        ) -> CGEventRef;
        pub fn CGEventSetFlags(event: CGEventRef, flags: CGEventFlags);
        pub fn CGEventPost(tap: CGEventTapLocation, event: CGEventRef);
    }

    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        pub fn CFRelease(cf: *const c_void);
    }
}

/// Post the four-event Cmd+V sequence to the HID event tap.
///
/// Returns after the events are queued — there's no completion callback,
/// so callers should sleep briefly afterwards to let the target app
/// process the paste before any follow-up (e.g. clipboard restore).
#[cfg(target_os = "macos")]
pub fn send_paste() -> Result<(), String> {
    use ffi::*;

    unsafe {
        let source = CGEventSourceCreate(K_CG_EVENT_SOURCE_STATE_HID_SYSTEM_STATE);
        if source.is_null() {
            return Err("CGEventSourceCreate returned null".into());
        }
        let _source_guard = scopeguard::guard(source, |s| CFRelease(s as *const c_void));

        let events = [
            (KEYCODE_LEFT_CMD, true, 0),
            (KEYCODE_V, true, K_CG_EVENT_FLAG_MASK_COMMAND),
            (KEYCODE_V, false, K_CG_EVENT_FLAG_MASK_COMMAND),
            (KEYCODE_LEFT_CMD, false, 0),
        ];

        // Build the four events up front so CFRelease happens after all posts.
        // Posting in a loop that interleaved create → post → release would
        // work, but keeping the events alive for the full sequence matches
        // the pattern CGEventPost's docs show and is easier to reason about.
        let mut guards = Vec::with_capacity(events.len());
        let mut created = Vec::with_capacity(events.len());

        for (key, down, flags) in events {
            let event = CGEventCreateKeyboardEvent(source, key, down);
            if event.is_null() {
                return Err(format!(
                    "CGEventCreateKeyboardEvent(key={}, down={}) returned null",
                    key, down
                ));
            }
            let guard = scopeguard::guard(event, |e| CFRelease(e as *const c_void));
            if flags != 0 {
                CGEventSetFlags(event, flags);
            }
            created.push(event);
            guards.push(guard);
        }

        for event in created {
            CGEventPost(K_CG_HID_EVENT_TAP, event);
        }

        drop(guards);
        Ok(())
    }
}

#[cfg(target_os = "windows")]
mod win {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP,
        VIRTUAL_KEY,
    };

    pub fn make_key(vk: VIRTUAL_KEY, up: bool) -> INPUT {
        let flags = if up {
            KEYEVENTF_KEYUP
        } else {
            KEYBD_EVENT_FLAGS(0)
        };
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: vk,
                    wScan: 0,
                    dwFlags: flags,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        }
    }
}

#[cfg(target_os = "windows")]
pub fn send_paste() -> Result<(), String> {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, VK_CONTROL, VK_V,
    };

    // Four-event Ctrl+V sequence. Matches the macOS CGEvent pattern: the
    // modifier brackets the letter so the target app sees a fully formed
    // accelerator rather than a lone V. `dwExtraInfo` is zero — we're not
    // tagging these as "ours" because no consumer in the paste path needs
    // to distinguish synthetic events from hardware ones.
    let events = [
        win::make_key(VK_CONTROL, false),
        win::make_key(VK_V, false),
        win::make_key(VK_V, true),
        win::make_key(VK_CONTROL, true),
    ];

    unsafe {
        let sent = SendInput(&events, std::mem::size_of::<INPUT>() as i32);
        if sent as usize != events.len() {
            return Err(format!(
                "SendInput delivered {} of {} events — the input desktop may be locked (secure attention sequence) or a higher-integrity window is intercepting.",
                sent,
                events.len()
            ));
        }
    }

    Ok(())
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn send_paste() -> Result<(), String> {
    Err("synthetic paste is not yet implemented on this platform".into())
}
