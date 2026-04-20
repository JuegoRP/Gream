// ═══════════════════════════════════
//  GREAM — router.js
//  Screen management + HTML loader
// ═══════════════════════════════════

const SCREEN_DIR = 'screens/';
let _history = [];
let _screensCache = {};

export const Router = {

  // ─── Load and show a screen ───
  async show(screenId, data = {}) {
    // Try inline screen first (camera is always in DOM)
    const inline = document.getElementById('screen-' + screenId);
    if (inline) {
      this._activateScreen(screenId);
      _history.push(screenId);
      return;
    }

    // Load from screens/ folder
    let html = _screensCache[screenId];
    if (!html) {
      try {
        const res = await fetch(`${SCREEN_DIR}${screenId}.html`);
        html = await res.text();
        _screensCache[screenId] = html;
      } catch {
        console.error('Screen not found:', screenId);
        return;
      }
    }

    // Inject into container
    const container = document.getElementById('screenContainer');
    container.innerHTML = `<div class="screen" id="screen-${screenId}">${html}</div>`;

    this._activateScreen(screenId);
    _history.push(screenId);

    // Wait one frame so DOM is painted before modules try to find elements
    await new Promise(resolve => requestAnimationFrame(resolve));

    // Dispatch screen-ready event for modules to bind
    document.dispatchEvent(new CustomEvent('screen:ready', { detail: { screenId, data } }));
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
    const prev = _history[_history.length - 1] || 'map';
    this.show(prev);
  },

  // ─── Current screen ───
  current() {
    return _history[_history.length - 1] || null;
  }
};
