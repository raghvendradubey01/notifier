import type { NotificationDigestPayload, NotificationToneId } from './schedulerLogic';

export type BrowserPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!sharedAudioCtx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export function getBrowserNotificationPermission(): BrowserPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as BrowserPermissionState;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await Notification.requestPermission();
    return result as BrowserPermissionState;
  } catch {
    return Notification.permission as BrowserPermissionState;
  }
}

/**
 * Plays one of the 6 distinct synthesized clock notification tones using Web Audio API.
 */
export function playNotificationTone(toneId: NotificationToneId = 'classic-alarm'): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    const scheduleNote = (
      freq: number,
      startOffset: number,
      duration: number,
      type: OscillatorType = 'sine',
      peakGain: number = 0.14
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + startOffset);

      gain.gain.setValueAtTime(0.0001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(peakGain, now + startOffset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    switch (toneId) {
      case 'classic-alarm': {
        // 4-pulse bedside digital alarm beep-beep-beep-beep
        [0, 0.16, 0.32, 0.48, 0.9, 1.06, 1.22, 1.38].forEach((offset) => {
          scheduleNote(880, offset, 0.11, 'triangle', 0.18);
        });
        break;
      }

      case 'morning-chime': {
        // Bright ascending 5-note harmonic crystal arpeggio
        const notes = [523.25, 659.25, 783.99, 987.77, 1174.66];
        notes.forEach((freq, i) => {
          scheduleNote(freq, i * 0.14, 0.45, 'sine', 0.15);
        });
        break;
      }

      case 'marimba-pulse': {
        // Warm percussive wooden melodic sequence
        const notes = [349.23, 440, 523.25, 698.46, 659.25, 523.25];
        notes.forEach((freq, i) => {
          scheduleNote(freq, i * 0.13, 0.18, 'triangle', 0.2);
          scheduleNote(freq * 2, i * 0.13, 0.08, 'sine', 0.06);
        });
        break;
      }

      case 'radar-beacon': {
        // Modern smartphone dual-tone wake sweep
        const pattern = [
          { f: 587.33, t: 0 },
          { f: 880.0, t: 0.18 },
          { f: 587.33, t: 0.45 },
          { f: 880.0, t: 0.63 },
          { f: 1174.66, t: 0.85 },
        ];
        pattern.forEach(({ f, t }) => {
          scheduleNote(f, t, 0.22, 'sine', 0.16);
          scheduleNote(f * 1.5, t, 0.16, 'sine', 0.06);
        });
        break;
      }

      case 'zen-bowl': {
        // Deep resonant harmonic singing bowl chime
        scheduleNote(432, 0, 1.6, 'sine', 0.18);
        scheduleNote(648, 0.02, 1.4, 'sine', 0.09);
        scheduleNote(864, 0.04, 1.1, 'sine', 0.06);
        break;
      }

      case 'urgent-buzzer': {
        // Energetic alternating twin-bell desk clock ring
        for (let i = 0; i < 10; i++) {
          const freq = i % 2 === 0 ? 1046.5 : 1318.5;
          scheduleNote(freq, i * 0.09, 0.08, 'square', 0.09);
        }
        break;
      }
    }
  } catch {
    // Ignore audio errors if blocked by browser policy
  }
}

/**
 * Fires a native browser push notification if permission is granted.
 */
export function sendBrowserPushNotification(payload: NotificationDigestPayload): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }
  try {
    new Notification(payload.title, {
      body: payload.body,
      tag: payload.id,
      silent: false,
    });
    return true;
  } catch {
    return false;
  }
}
