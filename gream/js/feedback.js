// ═══════════════════════════════════
//  GREAM — feedback.js  v4
//  WAV files s procedurálním fallbackem
// ═══════════════════════════════════

const SOUND_BASE = 'audio/';
const _cache = {};
let _soundEnabled = true;
let _audioCtx = null;

try {
  const stored = localStorage.getItem('gream_sound');
  if (stored === 'off') _soundEnabled = false;
} catch {}

function getAudio(name) {
  if (!_cache[name]) {
    const a = new Audio(SOUND_BASE + name + '.wav');
    a.preload = 'auto';
    _cache[name] = a;
  }
  return _cache[name];
}

function play(name, vol = 0.55) {
  if (!_soundEnabled) return false;
  try {
    const a = getAudio(name);
    a.volume = vol;
    a.currentTime = 0;
    const p = a.play();
    if (p?.catch) p.catch(() => {});
    return true;
  } catch { return false; }
}

function ctx() {
  if (!_audioCtx) {
    try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
  }
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

function tone(freq, ms, type = 'sine', vol = 0.12, delay = 0) {
  if (!_soundEnabled) return;
  const c = ctx(); if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type; osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, c.currentTime + delay);
  gain.gain.linearRampToValueAtTime(vol, c.currentTime + delay + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + ms / 1000);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime + delay);
  osc.stop(c.currentTime + delay + ms / 1000 + 0.05);
}

export const Feedback = {
  setSoundEnabled(on) {
    _soundEnabled = !!on;
    try { localStorage.setItem('gream_sound', on ? 'on' : 'off'); } catch {}
    if (on) setTimeout(() => tone(660, 80, 'sine', 0.08), 50);
  },
  soundEnabled() { return _soundEnabled; },
  haptic(p = 25) { if (navigator.vibrate) try { navigator.vibrate(p); } catch {} },

  tap()     { this.haptic(10); play('tap',0.35) || tone(520,35,'sine',0.06); },
  click()   { this.haptic(15); play('click',0.45) || tone(660,45,'sine',0.08); },
  pop()     { this.haptic(15); play('pop',0.45) || tone(800,55,'triangle',0.09); },

  success() {
    this.haptic([20,30,20]);
    if (!play('success',0.55)) { tone(660,80,'sine',0.1); tone(880,130,'sine',0.1,0.08); }
  },
  error() {
    this.haptic([40,60,40]);
    if (!play('error',0.5)) { tone(240,200,'sawtooth',0.07); }
  },
  stepDone() {
    this.haptic([20,40]);
    if (!play('step_done',0.55)) { tone(523,220,'sine',0.1); tone(659,180,'sine',0.08,0.08); }
  },
  celebrate() {
    this.haptic([30,50,30,50,30]);
    if (!play('badge_earned',0.65)) {
      [523,659,784,1047].forEach((f,i) => tone(f,140,'sine',0.12,i*0.1));
    }
  },
  worldUnlock() {
    this.haptic([40,60,40,60]);
    if (!play('world_unlock',0.6)) {
      [392,523,659,784,1047].forEach((f,i) => tone(f,180,'sine',0.1,i*0.08));
    }
  },
  evolve() {
    this.haptic([50,80,50,80,50]);
    play('world_unlock',0.7);
    [261,329,392,523,659,784,1047].forEach((f,i) => tone(f,200,'sine',0.08,i*0.07+0.1));
  },
  streak() {
    this.haptic([20,30,20,30,20]);
    if (!play('streak',0.5)) { [659,784,988].forEach((f,i) => tone(f,120,'sine',0.1,i*0.09)); }
  },
  streakMilestone() {
    this.haptic([30,50,30,50,80,50,30]);
    if (!play('badge_earned',0.8)) {
      [523,659,784,880,1047,1319].forEach((f,i) => tone(f,160,'sine',0.12,i*0.09));
    }
  },
  whoosh()    { play('whoosh',0.2) || tone(300,200,'sine',0.04); },
  geoArrive() {
    this.haptic([30,30,30]);
    if (!play('geo_arrive',0.55)) { tone(880,60,'sine',0.1); tone(1108,80,'sine',0.09,0.07); }
  },
  coin()  { this.haptic(20); play('coin',0.5) || (tone(1047,50,'sine',0.1), tone(1319,80,'sine',0.09,0.05)); },
  egg()  { this.haptic(15); tone(1568,40,'sine',0.09); tone(1760,60,'sine',0.07,0.04); },

  flashSuccess(el) { if (!el) return; el.classList.add('gream-flash-success'); setTimeout(() => el.classList.remove('gream-flash-success'), 450); },
  flashError(el)   { if (!el) return; el.classList.add('gream-shake'); setTimeout(() => el.classList.remove('gream-shake'), 400); },
};
