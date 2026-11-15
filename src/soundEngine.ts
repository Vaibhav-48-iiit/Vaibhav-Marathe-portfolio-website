import { SITE_CONFIG } from './config';

/**
 * Safely reads the user's sound mute preference from localStorage inside try/catch.
 * Defaults to `true` (muted) unless explicitly unmuted (`'0'`) while SOUND_ENABLED is true.
 */
export function getInitialSoundMuted(
  storage: Pick<Storage, 'getItem'> | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
): boolean {
  if (!SITE_CONFIG.sound.SOUND_ENABLED) return true;
  try {
    if (storage) {
      const saved = storage.getItem(SITE_CONFIG.sound.storageKey);
      if (saved === '0') return false;
      if (saved === '1') return true;
    }
  } catch {
    // Ignore storage errors safely
  }
  return SITE_CONFIG.sound.defaultMuted;
}

/**
 * Safely persists the user's sound mute preference in localStorage inside try/catch.
 */
export function saveSoundMutedPreference(
  muted: boolean,
  storage: Pick<Storage, 'setItem'> | null | undefined = typeof window !== 'undefined'
    ? window.localStorage
    : null,
): void {
  try {
    if (!storage) return;
    storage.setItem(SITE_CONFIG.sound.storageKey, muted ? '1' : '0');
  } catch {
    // Ignore storage errors safely
  }
}

let audioCtx: AudioContext | null = null;
let hasUserInteracted = false;

if (typeof window !== 'undefined') {
  const markInteracted = () => {
    hasUserInteracted = true;
  };
  window.addEventListener('pointerdown', markInteracted, { once: true, passive: true });
  window.addEventListener('keydown', markInteracted, { once: true, passive: true });
}

function getOrCreateAudioContext(): AudioContext | null {
  if (!SITE_CONFIG.sound.SOUND_ENABLED || !hasUserInteracted) return null;
  if (typeof window === 'undefined') return null;

  try {
    if (!audioCtx) {
      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextCtor) return null;
      audioCtx = new AudioContextCtor();
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Plays a short, soft synthesised key-click tick using the Web Audio API (no audio files).
 * Only plays if SOUND_ENABLED is true, sound is unmuted, and a user interaction has occurred.
 */
export function playTerminalKeyClick(muted: boolean): void {
  if (muted || !SITE_CONFIG.sound.SOUND_ENABLED) return;
  const ctx = getOrCreateAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    // Slight deterministic pitch variance around keyClickFrequencyHz for natural terminal feel
    const jitter = ((now * 997) % 1) * 90 - 45;
    osc.frequency.setValueAtTime(
      SITE_CONFIG.sound.keyClickFrequencyHz + jitter,
      now,
    );

    const duration = SITE_CONFIG.sound.keyClickDurationSec;
    gain.gain.setValueAtTime(SITE_CONFIG.sound.keyClickGain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  } catch {
    // Ignore audio context errors safely
  }
}
