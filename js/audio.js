// ═══════════════════════════════════
//  GREAM — audio.js  v4
//  Scene-based music, clean fade out → gap → fade in.
//  Seamless loop via crossfade on repeat only.
//  No procedural fallback. No overlap between scenes.
// ═══════════════════════════════════

const SCENE_MUSIC = {
  menu:      'audio/music_menu.mp3',
  challenge: 'audio/music_challenge.mp3',
  outdoor:   'audio/music_outdoor.mp3',
};

const FADE_OUT_MS  = 800;
const FADE_IN_MS   = 700;
const SWITCH_GAP   = 200;    // silent pause between fade-out and fade-in
const LOOP_FADE_MS = 1000;   // crossfade duration for seamless loop repeat
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
    el.loop = false;
    el.volume = 0;
    el.preload = 'auto';
    const p = el.play();
    if (!p) { reject(); return; }
    p.then(() => resolve(el)).catch(reject);
  });
}

// Seamless loop: crossfade near end of track (both play briefly)
function _attachLoop(el, src, gen) {
  let armed = false;
  const check = () => {
    if (_generation !== gen || !el.duration || armed) return;
    if (el.duration - el.currentTime > LOOP_FADE_MS / 1000 + 0.5) return;
    armed = true;
    el.removeEventListener('timeupdate', check);
    _fadeVolume(el, el.volume, 0, LOOP_FADE_MS, () => { try { el.pause(); } catch {} });
    _startAudio(src).then(newEl => {
      if (_generation !== gen) { try { newEl.pause(); } catch {} return; }
      _musicEl = newEl;
      _fadeVolume(newEl, 0, TARGET_VOL, Math.round(LOOP_FADE_MS * 0.8), null);
      _attachLoop(newEl, src, gen);
    }).catch(() => {
      // Buffer miss — restart same element
      if (_generation === gen) {
        el.currentTime = 0; el.play().catch(() => {});
        armed = false;
        _attachLoop(el, src, gen);
      }
    });
  };
  el.addEventListener('timeupdate', check);
}

export const Audio = {
  init() {
    try { _enabled = localStorage.getItem('gream_sound') !== 'off'; } catch {}
  },

  // Called on every touch/click — starts or retries music until it's actually playing
  onUserGesture() {
    if (!_enabled) return;
    if (_musicEl && !_musicEl.paused) return; // already playing, ignore
    this.switchScene(_currentScene || 'menu');
  },

  switchScene(scene) {
    if (!_enabled) return;
    // Skip only if same scene AND audio element is actually running
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
        _attachLoop(el, src, gen);
      }).catch(() => {
        // Autoplay blocked (mobile) — reset so onUserGesture retries
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
