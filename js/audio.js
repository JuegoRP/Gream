// ═══════════════════════════════════
//  GREAM — audio.js  v5
//  Scene-based music, clean fade out → gap → fade in.
//  Native loop (el.loop=true) — no new elements on repeat,
//  no mobile autoplay block after 2 cycles.
// ═══════════════════════════════════

const SCENE_MUSIC = {
  menu:      'audio/music_menu.mp3',
  challenge: 'audio/music_challenge.mp3',
  outdoor:   'audio/music_outdoor.mp3',
};

const FADE_OUT_MS  = 800;
const FADE_IN_MS   = 700;
const SWITCH_GAP   = 200;
const FADE_TICK_MS = 40;
const TARGET_VOL   = 0.25;

let _musicEl      = null;
let _currentScene = null;
let _enabled      = true;
let _running      = false;
let _generation   = 0;

try {
  if (localStorage.getItem('gream_sound') === 'off') _enabled = false;
} catch {}

function _fadeVolume(el, fromVol, toVol, durationMs, onDone) {
  if (!el) { onDone?.(); return; }
  const steps = Math.max(1, Math.ceil(durationMs / FADE_TICK_MS));
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

function _startAudio(src) {
  return new Promise((resolve, reject) => {
    const el = new window.Audio(src);
    el.loop    = true;   // native infinite loop — no new elements needed
    el.volume  = 0;
    el.preload = 'auto';
    const p = el.play();
    if (!p) { reject(); return; }
    p.then(() => resolve(el)).catch(reject);
  });
}

export const Audio = {
  init() {
    try { _enabled = localStorage.getItem('gream_sound') !== 'off'; } catch {}
  },

  // Called on every touch/click — starts or retries until actually playing
  onUserGesture() {
    if (!_enabled) return;
    if (_musicEl && !_musicEl.paused) return;
    this.switchScene(_currentScene || 'menu');
  },

  switchScene(scene) {
    if (!_enabled) return;
    if (scene === _currentScene && _running && _musicEl) return;

    const src = SCENE_MUSIC[scene];
    if (!src) return;

    _currentScene = scene;
    _running = true;
    const gen = ++_generation;

    const old = _musicEl;
    _musicEl = null;

    const startNew = () => {
      if (_generation !== gen) return;
      _startAudio(src).then(el => {
        if (_generation !== gen) { try { el.pause(); } catch {} return; }
        _musicEl = el;
        _fadeVolume(el, 0, TARGET_VOL, FADE_IN_MS, null);
      }).catch(() => {
        if (_generation === gen) _running = false;
      });
    };

    if (old) {
      _fadeVolume(old, old.volume, 0, FADE_OUT_MS, () => {
        try { old.pause(); } catch {}
        setTimeout(startNew, SWITCH_GAP);
      });
    } else {
      startNew();
    }
  },

  stopMusic() {
    _running = false;
    _currentScene = null;
    _generation++;
    const old = _musicEl;
    _musicEl = null;
    if (old) _fadeVolume(old, old.volume, 0, FADE_OUT_MS, () => { try { old.pause(); } catch {} });
  },

  setEnabled(on) {
    _enabled = !!on;
    try { localStorage.setItem('gream_sound', on ? 'on' : 'off'); } catch {}
    if (on) {
      if (_currentScene) { _running = false; this.switchScene(_currentScene); }
    } else {
      this.stopMusic();
    }
  },

  isRunning() { return _running; },
};
