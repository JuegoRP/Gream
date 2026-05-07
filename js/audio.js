// ═══════════════════════════════════
//  GREAM — audio.js  v2
//  Background music: HTML Audio with MP3 files when available,
//  procedural WebAudio ambient loop as fallback.
//  Scene-based switching with crossfade (0.8s).
// ═══════════════════════════════════

// Scene → ordered list of tracks to try (first available wins)
const SCENE_MUSIC = {
  menu:      ['audio/music_menu.mp3',      'audio/music_garden.ogg'],
  challenge: ['audio/music_challenge.mp3', 'audio/music_calm.ogg'],
  outdoor:   ['audio/music_outdoor.mp3',   'audio/music_garden.ogg'],
};

// Fallback: keep old generic list for procedural fallback
const MUSIC_FILES = [
  'audio/music_garden.ogg',
  'audio/music_calm.ogg',
];

const FADE_MS      = 800;   // crossfade duration
const FADE_TICK_MS = 40;    // interval for volume stepping
const TARGET_VOL   = 0.25;  // normal playback volume

let _ctx = null;
let _gainNode = null;
let _musicEl = null;
let _procTimer = null;
let _procStep = 0;
let _running = false;
let _enabled = true;
let _currentScene = null;
let _fadingOut = false;  // prevents double-fade

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
const _SCALE   = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
const _PATTERN = [0, 2, 4, 5, 4, 2, 0, 2,  4, 5, 6, 5, 4, 2, 3, 0];
const _PAD_FREQS = [[130.81, 164.81, 196.00], [146.83, 185.00, 220.00]];
const _STEP_DUR = 0.26;

function _scheduleChunk() {
  if (!_running || !_enabled) return;
  const c = _getCtx();
  const gn = _masterGain();
  if (!c || !gn) return;

  const now = c.currentTime;
  const chunkLen = 8;

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
  const delay = Math.max(0, chunkLen * _STEP_DUR * 1000 - 80);
  _procTimer = setTimeout(_scheduleChunk, delay);
}

function _stopProcedural() {
  clearTimeout(_procTimer);
  _procTimer = null;
}

// ─── Fade helper: linearly interpolate element volume from current to target over FADE_MS ───
function _fadeVolume(el, fromVol, toVol, onDone) {
  if (!el) { onDone?.(); return; }
  const steps = Math.ceil(FADE_MS / FADE_TICK_MS);
  const delta = (toVol - fromVol) / steps;
  let step = 0;
  el.volume = Math.max(0, Math.min(1, fromVol));
  const tick = setInterval(() => {
    step++;
    el.volume = Math.max(0, Math.min(1, fromVol + delta * step));
    if (step >= steps) {
      clearInterval(tick);
      el.volume = Math.max(0, Math.min(1, toVol));
      onDone?.();
    }
  }, FADE_TICK_MS);
}

// ─── Try to play tracks in order, call onFail if all fail ───
function _tryHtmlAudioList(tracks, onSuccess, onFail) {
  let i = 0;
  const attempt = () => {
    if (i >= tracks.length) { onFail(); return; }
    const src = tracks[i++];
    const el = new window.Audio(src);
    el.loop = false;  // we handle looping manually for seamless crossfade
    el.volume = 0;
    el.preload = 'auto';
    const p = el.play();
    if (!p) { attempt(); return; }
    p.then(() => {
      onSuccess(el, tracks);
    }).catch(() => attempt());
  };
  attempt();
}

// ─── Seamless loop: crossfade FADE_MS before track end into a fresh instance ───
function _attachLoopCrossfade(el, tracks) {
  let scheduled = false;
  const handler = () => {
    if (!el.duration || scheduled) return;
    const remaining = el.duration - el.currentTime;
    if (remaining > FADE_MS / 1000 + 0.6) return;
    scheduled = true;
    el.removeEventListener('timeupdate', handler);

    // Fade out current
    _fadeVolume(el, el.volume, 0, () => { try { el.pause(); } catch {} });

    // Start fresh instance and fade in
    _tryHtmlAudioList(tracks, (newEl) => {
      if (_musicEl !== el && _musicEl !== null) {
        // Scene changed during crossfade — don't hijack
        try { newEl.pause(); } catch {}
        return;
      }
      _musicEl = newEl;
      _fadeVolume(newEl, 0, TARGET_VOL, null);
      _attachLoopCrossfade(newEl, tracks);
    }, () => {
      // Fallback: restart same element
      if (_musicEl === el) {
        el.currentTime = 0;
        el.play().catch(() => {});
        scheduled = false;
        _attachLoopCrossfade(el, tracks);
      }
    });
  };
  el.addEventListener('timeupdate', handler);
}

// ─── Stop current music element with optional fade ───
function _stopCurrent(fade, onDone) {
  const el = _musicEl;
  _stopProcedural();

  if (!el) {
    // Stop procedural gain
    if (_gainNode) {
      const c = _getCtx();
      if (c) {
        _gainNode.gain.setValueAtTime(_gainNode.gain.value, c.currentTime);
        _gainNode.gain.linearRampToValueAtTime(0, c.currentTime + (fade ? FADE_MS / 1000 : 0.1));
        setTimeout(() => {
          try { _gainNode.disconnect(); } catch {}
          _gainNode = null;
          onDone?.();
        }, fade ? FADE_MS + 100 : 200);
      } else {
        onDone?.();
      }
    } else {
      onDone?.();
    }
    return;
  }

  _musicEl = null;

  if (fade) {
    _fadeVolume(el, el.volume, 0, () => {
      el.pause();
      el.currentTime = 0;
      onDone?.();
    });
  } else {
    el.pause();
    el.currentTime = 0;
    onDone?.();
  }
}

// ─── HTML Audio (generic fallback list) ───
function _tryHtmlAudio(onFail) {
  _tryHtmlAudioList(MUSIC_FILES, (el, tracks) => {
    _musicEl = el;
    _fadeVolume(el, 0, TARGET_VOL, null);
    _attachLoopCrossfade(el, tracks);
  }, onFail);
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
    if (_enabled && !_running) {
      // Use current scene if set, otherwise default to menu music
      this.switchScene(_currentScene || 'menu');
    }
  },

  startMusic() {
    if (_running) return;
    if (!_enabled) return;
    _running = true;

    _tryHtmlAudio(() => {
      _scheduleChunk();
    });
  },

  stopMusic() {
    _running = false;
    _currentScene = null;
    _stopCurrent(true, null);
  },

  /**
   * Switch to scene-specific music with crossfade.
   * scene: 'menu' | 'challenge' | 'outdoor'
   */
  switchScene(scene) {
    if (!_enabled) return;
    if (scene === _currentScene && _running) return; // already playing this scene

    const tracks = SCENE_MUSIC[scene];
    if (!tracks) return;

    _currentScene = scene;
    _running = true;

    // Fade out current, then fade in new
    if (_fadingOut) return; // already mid-transition
    _fadingOut = true;

    _stopCurrent(true, () => {
      _fadingOut = false;
      if (!_enabled) return;
      if (_currentScene !== scene) return; // scene changed again during fade

      _tryHtmlAudioList(tracks, (el, tlist) => {
        _musicEl = el;
        _fadeVolume(el, 0, TARGET_VOL, null);
        _attachLoopCrossfade(el, tlist);
      }, () => {
        // All MP3s failed — use procedural
        _scheduleChunk();
      });
    });
  },

  setEnabled(on) {
    _enabled = !!on;
    try { localStorage.setItem('gream_sound', on ? 'on' : 'off'); } catch {}
    if (on) {
      if (_currentScene) this.switchScene(_currentScene);
      else this.startMusic();
    } else {
      this.stopMusic();
    }
  },

  isRunning() { return _running; },
};
