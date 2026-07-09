// ═══════════════════════════════════
//  GREAM — audio.js  v7
//  Scene-based music with a SINGLE reused <audio> element.
//  Switching a scene only swaps el.src + crossfades volume — a second
//  track can never physically overlap (root-cause fix for the duplicate
//  music on mobile). One gesture unlocks autoplay for all scenes.
// ═══════════════════════════════════

const SCENE_MUSIC = {
  menu:      'audio/music_menu.mp3',
  challenge: 'audio/music_challenge.mp3',
  outdoor:   'audio/music_outdoor.mp3',
};

// Alternative menu track — bought with seeds, switchable in settings.
const MENU_ALT_SRC = 'audio/music_menu_alt.mp3';
function _menuSrc() {
  try {
    if (localStorage.getItem('gream_menu_track') === 'alt' &&
        localStorage.getItem('gream_menu_alt_owned') === '1') return MENU_ALT_SRC;
  } catch {}
  return SCENE_MUSIC.menu;
}
function _srcFor(scene) { return scene === 'menu' ? _menuSrc() : SCENE_MUSIC[scene]; }

const FADE_OUT_MS  = 800;
const FADE_IN_MS   = 700;
const SWITCH_GAP   = 150;
const FADE_TICK_MS = 40;
const TARGET_VOL   = 0.25;

let _el           = null;   // the ONE audio element (created on first play)
let _cryEl        = null;   // separate element for creature "cries" (voice SFX)
let _currentScene = null;   // scene whose src is loaded in _el
let _desiredScene = null;   // scene we want to hear (survives mute)
let _enabled      = true;
let _generation   = 0;      // cancels stale fades / pending swaps
let _fadeTimer    = null;

try {
  if (localStorage.getItem('gream_sound') === 'off') _enabled = false;
} catch {}

const _clamp = v => Math.max(0, Math.min(1, v));

function _ensureEl() {
  if (_el) return _el;
  _el = new window.Audio();
  _el.loop    = true;   // native infinite loop
  _el.preload = 'auto';
  _el.volume  = 0;
  return _el;
}

function _clearFade() {
  if (_fadeTimer) { clearInterval(_fadeTimer); _fadeTimer = null; }
}

// Fade the single element's volume to `target`. Only one fade runs at a time.
function _fadeTo(target, durationMs, onDone) {
  _clearFade();
  const el = _el;
  if (!el) { onDone?.(); return; }
  const steps = Math.max(1, Math.ceil(durationMs / FADE_TICK_MS));
  const from  = el.volume;
  const delta = (target - from) / steps;
  let step = 0;
  _fadeTimer = setInterval(() => {
    step++;
    el.volume = _clamp(from + delta * step);
    if (step >= steps) {
      _clearFade();
      el.volume = _clamp(target);
      onDone?.();
    }
  }, FADE_TICK_MS);
}

export const Audio = {
  init() {
    try { _enabled = localStorage.getItem('gream_sound') !== 'off'; } catch {}
  },

  // Called on every touch/click — (re)start the desired scene if nothing plays.
  // Reuses the single element, so it can never spawn a second track.
  onUserGesture() {
    if (!_enabled) return;
    if (_el && !_el.paused) return;         // already playing
    const scene = _desiredScene || _currentScene || 'menu';
    _currentScene = null;                    // force switchScene to (re)load
    this.switchScene(scene);
  },

  switchScene(scene) {
    if (!SCENE_MUSIC[scene]) return;
    _desiredScene = scene;
    if (!_enabled) return;
    // Already on this scene and audibly playing → nothing to do.
    if (scene === _currentScene && _el && !_el.paused) return;

    _currentScene = scene;
    const gen = ++_generation;
    const el  = _ensureEl();

    const swap = () => {
      if (gen !== _generation) return;
      try {
        el.src = _srcFor(scene);
        el.volume = 0;
        const p = el.play();
        if (p) p.then(() => { if (gen === _generation) _fadeTo(TARGET_VOL, FADE_IN_MS); })
               .catch(() => {}); // autoplay blocked → next gesture retries
      } catch {}
    };

    if (el.src && !el.paused) {
      // Crossfade: fade the current track down, then reuse the element for the new src.
      _fadeTo(0, FADE_OUT_MS, () => {
        if (gen !== _generation) return;
        setTimeout(swap, SWITCH_GAP);
      });
    } else {
      swap();
    }
  },

  stopMusic() {
    _currentScene = null;   // keep _desiredScene so unmute resumes the right track
    _generation++;
    _fadeTo(0, FADE_OUT_MS, () => { try { _el && _el.pause(); } catch {} });
  },

  setEnabled(on) {
    _enabled = !!on;
    try { localStorage.setItem('gream_sound', on ? 'on' : 'off'); } catch {}
    if (on) {
      const scene = _desiredScene || _currentScene || 'menu';
      _currentScene = null;
      this.switchScene(scene);
    } else {
      this.stopMusic();
    }
  },

  isRunning() { return !!(_el && !_el.paused); },

  // ─── Creature "cry" — a cute per-archetype voice, played on tap/hatch/evolve.
  // Same sound for all evolutions of an archetype, just deeper the bigger it is. ───
  playCry(archetype, stage = 2) {
    if (!archetype) return;
    try { if (localStorage.getItem('gream_sound') === 'off') return; } catch {}
    // Bigger evolution → lower pitch (deeper voice).
    const rate = stage >= 4 ? 0.80 : stage === 3 ? 0.92 : 1.12;
    try {
      const el = _cryEl || (_cryEl = new window.Audio());
      el.src = `audio/cry_${archetype}.mp3`;
      el.playbackRate = rate;
      el.volume = 0.75;
      el.currentTime = 0;
      const p = el.play();
      if (p) p.catch(() => {});
    } catch {}
  },

  // ─── Menu music selection (default vs bought alternative) ───
  getMenuTrack() { try { return localStorage.getItem('gream_menu_track') === 'alt' ? 'alt' : 'default'; } catch { return 'default'; } },
  menuAltOwned() { try { return localStorage.getItem('gream_menu_alt_owned') === '1'; } catch { return false; } },
  setMenuAltOwned(v) { try { localStorage.setItem('gream_menu_alt_owned', v ? '1' : '0'); } catch {} },
  setMenuTrack(which) {
    const val = which === 'alt' ? 'alt' : 'default';
    try { localStorage.setItem('gream_menu_track', val); } catch {}
    // If the menu is currently playing, reload so the change is heard immediately.
    if (_currentScene === 'menu') { _currentScene = null; this.switchScene('menu'); }
  },
};
