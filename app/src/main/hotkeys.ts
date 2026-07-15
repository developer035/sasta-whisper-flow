import { globalShortcut } from 'electron';

// ─── Types ────────────────────────────────────────────────────────────────────

export type HotkeyState = 'idle' | 'recording_ptt' | 'recording_locked' | 'transcribing';

type StateChangeHandler = (state: HotkeyState) => void;

// ─── State ────────────────────────────────────────────────────────────────────

let state: HotkeyState = 'idle';
let onStateChange: StateChangeHandler | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setState(next: HotkeyState): void {
  console.log(`[hotkey] -> ${next}`);
  state = next;
  onStateChange?.(state);
}

/** Called by index.ts once the async transcription pipeline finishes. */
export function forceIdle(): void {
  setState('idle');
}

/** Wire the callback that index.ts uses to drive the recording/transcription pipeline. */
export function setStateChangeCallback(cb: StateChangeHandler): void {
  onStateChange = cb;
}

// ─── Shortcut registration ────────────────────────────────────────────────────

/**
 * Ctrl+Shift+R — primary toggle
 *   idle              → recording_ptt
 *   recording_ptt     → transcribing  (pipeline runs async in index.ts)
 *   recording_locked  → transcribing
 *
 * Ctrl+Shift+L — hands-free lock
 *   idle              → recording_locked
 *   recording_ptt     → recording_locked
 *
 * NOTE: globalShortcut has no keyup events; PTT becomes press-to-toggle.
 * Must be called after app.whenReady().
 */
export function startHotkeyListener(): void {
  const mainOk = globalShortcut.register('Control+Shift+R', () => {
    switch (state) {
      case 'idle':
        setState('recording_ptt');
        break;
      case 'recording_ptt':
      case 'recording_locked':
        setState('transcribing');
        // index.ts state-change callback drives the rest; it calls forceIdle() on completion
        break;
      default:
        break; // ignore keypresses while transcribing
    }
  });
  if (!mainOk) console.warn('[hotkey] Control+Shift+R registration failed.');

  const lockedOk = globalShortcut.register('Control+Shift+L', () => {
    switch (state) {
      case 'idle':
      case 'recording_ptt':
        setState('recording_locked');
        break;
      default:
        break;
    }
  });
  if (!lockedOk) console.warn('[hotkey] Control+Shift+L registration failed.');

  console.log('[hotkey] Global shortcuts registered.');
}

export function stopHotkeyListener(): void {
  globalShortcut.unregisterAll();
  console.log('[hotkey] Global shortcuts unregistered.');
}
