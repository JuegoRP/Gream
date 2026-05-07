// ═══════════════════════════════════
//  GREAM — audio.js  v3
//  Scene-based music (3 MP3s), crossfade, seamless loop.
//  No procedural fallback. No overlap.
// ═══════════════════════════════════

const SCENE_MUSIC = {
  menu:      'audio/music_menu.mp3',
  challenge: 'audio/music_challenge.mp3',
  outdoor:   'audio/music_outdoor.mp3',
};

const FADE_MS      = 900;
const FADE_TICK_MS = 40;
const TARGET_VOL   = 0.25;

let _musicEl      = null;   // currently playing element
let _currentScene = null;
let _enabled      = true;
let _running      = false;
let _generation   = 0;      // incremented on each switchScene call to cancel stale callbacks

try {
  if (localStorage.getItem('gream_sound') === 'off') _enabled = false;
} catch {}

// ─── Linear volume fade ───
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

// ─── Play a URL, resolve with element or reject ───
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

// ─── Attach seamless loop: crossfade before track ends ───
function _attachLoop(el, src, gen) {
  let armed = false;
  const check = () => {
    if (_generation !== gen || !el.duration || armed) return;
    if (el.duration - el.currentTime > FADE_MS / 1000 + 0.5) return;
    armed = true;
    el.removeEventListener('timeupdate', check);
    // Fade out current
    _fadeVolume(el, el.volume, 0, () => { try { el.pause(); } catch {} });
    // Start fresh instance
    _startAudio(src).then(newEl => {
      if (_generation !== gen) { try { newEl.pause(); } catch {} return; }
      _musicEl = newEl;
      _fadeVolume(newEl, 0, TARGET_VOL, null);
      _attachLoop(newEl, src, gen);
    }).catch(() => {
      // Restart same element as fallback
      if (_generation === gen && _musicEl === el) {
        el.currentTime = 0; el.play().catch(() => {});
        armed = false;
        _attachLoop(el, src, gen);
      }
    });
  };
  el.addEventListener('timeupdate', check);
}

// ─── Public API ───
export const Audio = {
  init() {
    try { _enabled = localStorage.getItem('gream_sound') !== 'off'; } catch {}
  },

  onUserGesture() {
    if (_enabled && !_running) this.switchScene(_currentScene || 'menu');
  },

  switchScene(scene) {
    if (!_enabled) return;
    if (scene === _currentScene && _running) return;

    const src = SCENE_MUSIC[scene];
    if (!src) return;

    _currentScene = scene;
    _running = true;
    const gen = ++_generation; // invalidates all previous callbacks

    // Fade out + stop current
    const old = _musicEl;
    _musicEl = null;
    if (old) {
      _fadeVolume(old, old.volume, 0, () => { try { old.pause(); } catch {} });
    }

    // Start new track after short overlap window
    const delay = old ? FADE_MS * 0.6 : 0;
    setTimeout(() => {
      if (_generation !== gen) return;
      _startAudio(src).then(el => {
        if (_generation !== gen) { try { el.pause(); } catch {} return; }
        _musicEl = el;
        _fadeVolume(el, 0, TARGET_VOL, null);
        _attachLoop(el, src, gen);
      }).catch(() => {});
    }, delay);
  },

  stopMusic() {
    _running = false;
    _currentScene = null;
    _generation++;
    const old = _musicEl;
    _musicEl = null;
    if (old) _fadeVolume(old, old.volume, 0, () => { try { old.pause(); } catch {} });
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
