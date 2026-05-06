// ═══════════════════════════════════
//  GREAM — router.js  v5
//  + Loading state during fetch
//  + Slide animation between screens
//  + Cleanup of dangling callbacks
// ═══════════════════════════════════

const SCREEN_DIR = 'screens/';
let _history = [];
let _screensCache = {};
let _transitioning = false;

// ─── Cleanup callbacks left over from previous screen ───
function cleanupCallbacks(prevScreen, nextScreen) {
  // Destroy map when leaving map-view to free GPS watcher + Leaflet
  if (prevScreen === 'map-view' && nextScreen !== 'map-view') {
    try { window.MapView?.destroy?.(); } catch {}
  }
  // Draw callback only valid on draw screen
  if (prevScreen === 'draw' && nextScreen !== 'draw') {
    window._drawOnDone = null;
  }
  // Write callback only valid on write screen
  if (prevScreen === 'write' && nextScreen !== 'write') {
    window._writeOnDone = null;
  }
  // Voice callback only valid on voice-record screen
  if (prevScreen === 'voice-record' && nextScreen !== 'voice-record') {
    window._voiceOnComplete = null;
  }
  // Parent confirm callback only valid on parent-confirm screen
  if (prevScreen === 'parent-confirm' && nextScreen !== 'parent-confirm') {
    window._parentOnConfirm = null;
  }
  // Geo gate callbacks
  if (prevScreen === 'geo-gate' && nextScreen !== 'geo-gate') {
    window._geoOnConfirm = null;
    window._geoOnCancel  = null;
  }
  // Tear down Leaflet map when leaving map-view
  if (prevScreen === 'map-view' && nextScreen !== 'map-view') {
    import('./mapview.js').then(m => m.MapView.destroy()).catch(() => {});
  }
  // Clear stale Challenge state when leaving challenge to non-challenge screen
  // (but keep state if going to step-done / badge-earned / parent-confirm — those are part of the flow)
  if (prevScreen === 'challenge') {
    const next = nextScreen;
    const inFlow = ['step-done','badge-earned','parent-confirm','draw','write','voice-record','camera'].includes(next);
    if (!inFlow) {
      // Clear challenge state via dynamic import to avoid circular dep
      import('./challenge.js').then(m => {
        if (m.Challenge) {
          m.Challenge._currentChallenge = null;
          m.Challenge._world = null;
          m.Challenge._proof = null;
        }
      }).catch(() => {});
    }
  }
}

// ─── Show loading spinner during async fetch ───
function showLoading() {
  let loader = document.getElementById('gream-loader');
  if (loader) return;
  loader = document.createElement('div');
  loader.id = 'gream-loader';
  loader.innerHTML = '<div class="gream-spinner"></div>';
  document.body.appendChild(loader);
}
function hideLoading() {
  document.getElementById('gream-loader')?.remove();
}

export const Router = {

  // ─── Load and show a screen ───
  async show(screenId, data = {}) {
    if (_transitioning) return;
    _transitioning = true;

    const prevScreen = this.current();
    cleanupCallbacks(prevScreen, screenId);

    // Try inline screen first (camera is always in DOM)
    const inline = document.getElementById('screen-' + screenId);
    if (inline) {
      this._activateScreen(screenId);
      if (_history[_history.length - 1] !== screenId) {
        _history.push(screenId);
      }
      _transitioning = false;
      return;
    }

    // Load from screens/ folder
    let html = _screensCache[screenId];
    if (!html) {
      const loaderTimer = setTimeout(showLoading, 120);
      try {
        const res = await fetch(`${SCREEN_DIR}${screenId}.html`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} for ${screenId}.html`);
        }
        html = await res.text();
        _screensCache[screenId] = html;
      } catch (err) {
        console.error('[Router] Failed to load screen:', screenId, err);
        clearTimeout(loaderTimer);
        hideLoading();
        // Show visible error to user instead of silent failure
        const container = document.getElementById('screenContainer');
        if (container) {
          container.innerHTML = `
            <div class="screen" id="screen-${screenId}" style="padding:24px;text-align:center">
              <h2 style="color:#c54a3d">⚠️ Loading error</h2>
              <p style="color:#666;font-size:14px;margin:12px 0">
                Could not load screen: <code>${screenId}.html</code>
              </p>
              <p style="color:#666;font-size:13px;margin:8px 0">
                ${err.message}
              </p>
              <p style="color:#888;font-size:12px;margin-top:20px">
                If you opened the page via <code>file://</code>, switch to <code>http://localhost:8000</code>.
              </p>
              <button onclick="location.reload()" style="margin-top:16px;padding:10px 20px;border:none;border-radius:8px;background:#4a8a2e;color:white;font-weight:700;cursor:pointer">Reload</button>
            </div>`;
          this._activateScreen(screenId);
        }
        _transitioning = false;
        return;
      }
      clearTimeout(loaderTimer);
      hideLoading();
    }

    // Inject into container with anim-slide class for animation
    const container = document.getElementById('screenContainer');
    container.innerHTML = `<div class="screen anim-slide-in" id="screen-${screenId}">${html}</div>`;

    this._activateScreen(screenId);
    // Don't push same screen twice in a row (prevents stacking)
    if (_history[_history.length - 1] !== screenId) {
      _history.push(screenId);
    }

    // Wait one frame so DOM is painted before modules try to find elements
    await new Promise(resolve => requestAnimationFrame(resolve));

    // Dispatch screen-ready event for modules to bind
    document.dispatchEvent(new CustomEvent('screen:ready', { detail: { screenId, data } }));

    _transitioning = false;
  },

  // ─── Activate one screen, hide all others ───
  _activateScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById('screen-' + screenId);
    if (target) target.classList.remove('hidden');

    // Show/hide lang toggle
    const toggle = document.getElementById('gLangToggle');
    if (toggle) {
      const showToggle = ['onboarding', 'profiles'].includes(screenId);
      toggle.classList.toggle('hidden', !showToggle);
    }
  },

  // ─── Show a pre-existing screen (camera etc.) ───
  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const el = document.getElementById('screen-' + screenId);
    if (el) el.classList.remove('hidden');
  },

  // ─── Go back ───
  back() {
    _history.pop();
    // Skip any consecutive challenge entries that may have stacked up
    while (_history.length > 1 && _history[_history.length - 1] === 'challenge') {
      _history.pop();
    }
    const prev = _history[_history.length - 1] || 'home';
    this.show(prev);
  },

  // ─── Current screen ───
  current() {
    return _history[_history.length - 1] || null;
  },

  // ─── Prefetch screens into cache silently ───
  prefetch(screenIds) {
    screenIds.forEach(id => {
      if (_screensCache[id]) return;
      fetch(`${SCREEN_DIR}${id}.html`)
        .then(r => r.ok ? r.text() : null)
        .then(html => { if (html) _screensCache[id] = html; })
        .catch(() => {});
    });
  }
};
