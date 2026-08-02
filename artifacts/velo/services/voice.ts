// Spoken turn-by-turn guidance for the driver trip. A thin wrapper over
// expo-speech with a global mute flag and simple de-duping so the same phrase
// isn't repeated back-to-back. Voice is best-effort — if TTS is unavailable
// (web / no engine) calls are silently ignored.
import * as Speech from 'expo-speech';

let muted = false;
let lastPhrase = '';
let lastAt = 0;

export function setVoiceMuted(m: boolean) {
  muted = m;
  if (m) Speech.stop();
}

export function isVoiceMuted() {
  return muted;
}

// Speak a phrase. `dedupeMs` suppresses an identical phrase spoken again within
// the window (default 8s) so a lingering GPS position can't spam it.
export function speak(phrase: string, opts?: { dedupeMs?: number; interrupt?: boolean }) {
  if (muted || !phrase) return;
  const now = Date.now();
  const dedupe = opts?.dedupeMs ?? 8000;
  if (phrase === lastPhrase && now - lastAt < dedupe) return;
  lastPhrase = phrase;
  lastAt = now;
  try {
    if (opts?.interrupt) Speech.stop();
    Speech.speak(phrase, { language: 'en', rate: 1.0, pitch: 1.0 });
  } catch {
    // no TTS engine — ignore
  }
}

export function stopVoice() {
  try { Speech.stop(); } catch { /* ignore */ }
}
