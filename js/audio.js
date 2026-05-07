// ═══════════════════════════════════
//  GREAM — audio.js  v1
//  Background music: HTML Audio with MP3 files when available,
//  procedural WebAudio ambient loop as fallback.
//
//  To add real music: drop MP3 files into /audio/ and list in MUSIC_FILES.
//  Recommended free sources (CC): incompetech.com (CC BY), freemusicarchive.org
// ═══════════════════════════════════

const MUSIC_FILES = [
  'audio/music_garden.mp3',   // drop a proper ambient loop here when ready
  'audio/music_calm.mp3',
];

let _ctx = null;
let _gainNode = null;
let _musicEl = null;
let _procTimer = null;
let _procStep = 0;
let _running = false;
let _enabled = true;

try {
  const stored = localStorage.getItem('gream_sound');
  if (stored === 'off') _enabled = false;
} catch {}

// ─── WebAudio context (shared, lazy) ───
function _getCtx() {
  if (!_ctx) {
    try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

function _masterGain() {
  const c = _getCtx();
  if (!c) return null;
  if (!_gainNode) {
    _gainNode = c.createGain();
    _gainNode.gain.value = 0.18;
    _gainNode.connect(c.destination);
  }
  return _gainNode;
}

// ─── Procedural ambient garden loop ───
// Gentle C-pentatonic arpeggio at 72 BPM.
// Each call schedules 8 notes, then reschedules itself.
const _SCALE   = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
const _PATTERN = [0, 2, 4, 5, 4, 2, 0, 2,  4, 5, 6, 5, 4, 2, 3, 0];
const _PAD_FREQS = [[130.81, 164.81, 196.00], [146.83, 185.00, 220.00]]; // C3 and D3 chords
const _STEP_DUR = 0.26; // seconds per note (~72 BPM sixteenth)

function _scheduleChunk() {
  if (!_running || !_enabled) return;
  const c = _getCtx();
  const gn = _masterGain();
  if (!c || !gn) return;

  const now = c.currentTime;
  const chunkLen = 8;

  // Melody notes
  for (let i = 0; i < chunkLen; i++) {
    const t = now + i * _STEP_DUR;
    const freq = _SCALE[_PATTERN[(_procStep + i) % _PATTERN.length]];
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t + _STEP_DUR * 0.82);
    osc.connect(gain).connect(gn);
    osc.start(t);
    osc.stop(t + _STEP_DUR);
  }

  // Soft pad chord every 8 steps
  const padChord = _PAD_FREQS[Math.floor(_procStep / chunkLen) % _PAD_FREQS.length];
  padChord.forEach(freq => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const dur = chunkLen * _STEP_DUR;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.04, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain).connect(gn);
    osc.start(now);
    osc.stop(now + dur);
  });

  _procStep = (_procStep + chunkLen) % (_PATTERN.length * 2);

  // Reschedule with slight overlap to avoid gaps
  const delay = Math.max(0, chunkLen * _STEP_DUR * 1000 - 80);
  _procTimer = setTimeout(_scheduleChunk, delay);
}

function _stopProcedural() {
  clearTimeout(_procTimer);
  _procTimer = null;
}

// ─── HTML Audio (MP3 files) ───
function _tryHtmlAudio(onFail) {
  let tried = 0;
  const attempt = (i) => {
    if (i >= MUSIC_FILES.length) { onFail(); return; }
    const el = new window.Audio(MUSIC_FILES[i]);
    el.loop = true;
    el.volume = 0.25;
    el.preload = 'auto';
    const p = el.play();
    if (!p) { onFail(); return; }
    p.then(() => {
      _musicEl = el;
    }).catch(() => attempt(i + 1));
  };
  attempt(0);
}

// ─── Public API ───
export const Audio = {
  /** Call once on app init */
  init() {
    const stored = localStorage.getItem('gream_sound');
    _enabled = stored !== 'off';
  },

  /** Call on first user gesture (required for iOS AudioContext) */
  onUserGesture() {
    const c = _getCtx();
    if (c?.state === 'suspended') c.resume().catch(() => {});
    if (_enabled && !_running) this.startMusic();
  },

  startMusic() {
    if (_running) return;
    if (!_enabled) return;
    _running = true;

    _tryHtmlAudio(() => {
      // No MP3 files found — use procedural loop
      _scheduleChunk();
    });
  },

  stopMusic() {
    _running = false;
    if (_musicEl) {
      // Fade out over 1.5s
      const el = _musicEl;
      const tick = setInterval(() => {
        if (el.volume > 0.04) el.volume = Math.max(0, el.volume - 0.04);
        else { el.pause(); el.currentTime = 0; clearInterval(tick); }
      }, 80);
    }
    _stopProcedural();
    if (_gainNode) {
      const c = _getCtx();
      if (c) {
        _gainNode.gain.setValueAtTime(_gainNode.gain.value, c.currentTime);
        _gainNode.gain.linearRampToValueAtTime(0, c.currentTime + 0.8);
        setTimeout(() => {
          try { _gainNode.disconnect(); } catch {}
          _gainNode = null;
        }, 900);
      }
    }
  },

  setEnabled(on) {
    _enabled = !!on;
    if (on) { this.startMusic(); }
    else    { this.stopMusic(); }
  },

  isRunning() { return _running; },
};
