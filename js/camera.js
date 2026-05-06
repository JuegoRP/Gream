// ═══════════════════════════════════
//  GREAM — camera.js  v4
//  Fixed: camera close → challenge (not Router.back)
//  Fixed: draw canvas id preserved after cloneNode
//  Added: canvas empty check for validation
// ═══════════════════════════════════

import { Router } from './router.js';

// ─── CAMERA ───
export const Camera = {
  _stream:  null,
  _onPhoto: null,

  async open(onPhoto) {
    this._onPhoto = onPhoto;
    Router.showScreen('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      this._stream = stream;
      document.getElementById('videoEl').srcObject = stream;
    } catch(err) {
      // Camera error — stop any partial stream, go back to challenge
      this._stopStream();
      const lang = localStorage.getItem('gream_lang') || 'en';
      alert(lang === 'cs'
        ? 'Fotoaparát není dostupný. Zkus nakreslit! 🎨'
        : 'Camera not available. Try drawing instead! 🎨');
      // Go directly to challenge — not Router.back() which might go wrong place
      await Router.show('challenge');
    }
  },

  takePhoto() {
    const video  = document.getElementById('videoEl');
    const canvas = document.getElementById('canvasEl');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    this._stopStream();
    // Hide camera screen, show challenge
    document.getElementById('screen-camera')?.classList.add('hidden');
    this._onPhoto?.(dataUrl);
  },

  // ─── Close without taking photo — go back to challenge ───
  async close() {
    this._stopStream();
    document.getElementById('screen-camera')?.classList.add('hidden');
    // Re-show challenge screen (already in DOM from Router)
    const challengeScreen = document.getElementById('screen-challenge');
    if (challengeScreen) {
      challengeScreen.classList.remove('hidden');
    } else {
      await Router.show('challenge');
    }
  },

  _stopStream() {
    this._stream?.getTracks().forEach(t => t.stop());
    this._stream = null;
  }
};

// ─── DRAW ───
export const Draw = {
  _color:   '#2d5a1b',
  _size:    5,
  _drawing: false,
  _lastX:   0,
  _lastY:   0,

  async open(onDone) {
    window._drawOnDone = onDone;
    await Router.show('draw');
  },

  init() {
    const c = document.getElementById('drawCanvas');
    if (!c) return;
    const w = Math.min(c.parentElement?.offsetWidth || 360, 420);
    c.width  = w;
    c.height = Math.min(w * 0.72, window.innerHeight * 0.44);
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, c.width, c.height);
    this._attachEvents(c);
  },

  _attachEvents(canvas) {
    // Clone to strip stale listeners, then restore id
    const fresh = canvas.cloneNode(false);
    fresh.id     = 'drawCanvas';   // ← keep the id so clear() / done() find it
    fresh.width  = canvas.width;
    fresh.height = canvas.height;
    if (canvas.parentNode) canvas.parentNode.replaceChild(fresh, canvas);

    // White background
    const ctx = fresh.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, fresh.width, fresh.height);

    const pos = e => {
      const r  = fresh.getBoundingClientRect();
      const t2 = e.touches ? e.touches[0] : e;
      return {
        x: (t2.clientX - r.left) * (fresh.width  / r.width),
        y: (t2.clientY - r.top)  * (fresh.height / r.height)
      };
    };
    const start = e => {
      e.preventDefault();
      this._drawing = true;
      const p = pos(e); this._lastX = p.x; this._lastY = p.y;
    };
    const draw = e => {
      e.preventDefault();
      if (!this._drawing) return;
      const p = pos(e), ctx2 = fresh.getContext('2d');
      ctx2.beginPath();
      ctx2.moveTo(this._lastX, this._lastY);
      ctx2.lineTo(p.x, p.y);
      ctx2.strokeStyle = this._color;
      ctx2.lineWidth   = this._size;
      ctx2.lineCap = ctx2.lineJoin = 'round';
      ctx2.stroke();
      this._lastX = p.x; this._lastY = p.y;
    };
    const stop = () => { this._drawing = false; };

    fresh.addEventListener('mousedown',  start);
    fresh.addEventListener('mousemove',  draw);
    fresh.addEventListener('mouseup',    stop);
    fresh.addEventListener('mouseleave', stop);
    fresh.addEventListener('touchstart', start, { passive: false });
    fresh.addEventListener('touchmove',  draw,  { passive: false });
    fresh.addEventListener('touchend',   stop);
  },

  setColor(color) { this._color = color; },
  setSize(size)   { this._size  = size;  },

  clear() {
    const c = document.getElementById('drawCanvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, c.width, c.height);
  },

  // ─── Check if canvas has meaningful content ───
  isEmpty() {
    const c = document.getElementById('drawCanvas');
    if (!c) return true;
    const ctx  = c.getContext('2d');
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    // Canvas is empty if all pixels are white (255,255,255,255)
    let nonWhite = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 250 || data[i+1] < 250 || data[i+2] < 250) nonWhite++;
      if (nonWhite > 50) return false; // enough marks → not empty
    }
    return true;
  },

  done() {
    if (this.isEmpty()) {
      const lang = localStorage.getItem('gream_lang') || 'en';
      alert(lang === 'cs'
        ? 'Nakresli něco nejdřív! ✏️'
        : 'Draw something first! ✏️');
      return;
    }
    const c = document.getElementById('drawCanvas');
    if (!c) return;
    const dataUrl = c.toDataURL('image/png');
    const cb = window._drawOnDone;
    window._drawOnDone = null;
    cb?.(dataUrl);
  }
};

// ─── TEXT INPUT ───
export const TextInput = {
  async open(onDone) {
    window._writeOnDone = onDone;
    await Router.show('write');
  },

  done() {
    const el   = document.getElementById('writeTextarea');
    const text = el?.value.trim();
    if (!text) return;
    const cb = window._writeOnDone;
    window._writeOnDone = null;
    cb?.(text);
  }
};
