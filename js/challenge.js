// ═══════════════════════════════════
//  GREAM — challenge.js  v6
//  + Geo mode (outdoor_required / outdoor_bonus / indoor_ok)
//  + Seeds awarded per task / badge / outdoor bonus
//  + Skin unlock check after task completion
// ═══════════════════════════════════

import { tr } from './i18n.js';
import { Profiles } from './profiles.js';
import { Badges } from './badges.js';
import { Router } from './router.js';
import { Validator } from './validator.js';
import { Feedback } from './feedback.js';
import { Geo } from './geo.js';
import { Skins } from './skins.js';
import { Gream, ARCHETYPES, spritePath } from './gream.js';
import { Subscription } from './subscription.js';

const WORLD_ICONS = { nature:'🌿', language:'📖', logic:'🧩', feelings:'💛', arts:'🎨', world:'🌍' };

const ACTION_CFG = {
  choice: { icon:'🎯', key:'btn_choice', cls:'btn-choice' },
  number: { icon:'🔢', key:'btn_number', cls:'btn-number' }
};

const MIN_VOICE_MS = {}; // kept for backward compat, unused

export const Challenge = {
  _world:            null,
  _currentStep:      0,
  _proof:            null,
  _proofType:        null,
  _currentChallenge: null,
  _wasOutdoor:       false,
  _targetPOI:        null,  // optional POI from map view
  _validating:       false, // double-click guard

  // ─── Open world ───
  // opts: { poi: {...} } when launched from map
  //       { indoor: true } when user explicitly chose home mode (skips geo gate)
  async open(world, opts = {}) {
    const p = Profiles.active();
    if (!p) return;
    this._world      = world;
    this._proof      = null;
    this._proofType  = null;
    this._wasOutdoor = false;
    this._targetPOI  = opts.poi || null;
    this._indoorMode = !!opts.indoor;
    this._validating = false; // reset double-click guard
    this._wrongCount = 0;

    const t   = tr();
    const lang = localStorage.getItem('gream_lang') || 'en';

    // ─── Difficulty → challenge key mapping ───
    const DIFF_KEY = { easy: 'easy', medium: 'medium', hard: 'hard', extreme: 'extreme' };
    let difficulty = p.difficulty || 'medium';

    // boost_lucky: let user temporarily override difficulty
    const luckyBoost = Skins.getPendingBoost(p.id);
    if (luckyBoost === 'boost_lucky') {
      const picked = await this._pickDifficultyOverlay(lang);
      if (picked) { Skins.consumePendingBoost(p.id); difficulty = picked; }
    }

    this._difficulty = difficulty;
    const diffKey = DIFF_KEY[difficulty] || 'medium';

    let challenges = t.challenges[world];
    let steps = Array.isArray(challenges)
      ? challenges
      : (challenges?.[diffKey] || challenges?.['medium'] || challenges?.['easy'] || []);

    const stepsDone   = Profiles.getBadgeProgress(p.id, world);
    this._currentStep = Math.min(stepsDone, steps.length - 1);
    const challenge   = steps[this._currentStep];
    if (!challenge) return;
    this._currentChallenge = challenge;

    const stepDefs = t.steps[world] || [];
    const badge    = Badges.getBadge(world, p.worldTasks?.[world] || 0);

    // Geo gate only when: (a) NOT indoor mode, (b) challenge requires outdoor, (c) NOT launched from POI map (POI = already verified intent)
    const mode = challenge.mode || 'indoor_ok';
    if (!this._indoorMode && !this._targetPOI && mode === 'outdoor_required') {
      const gateOk = await this._geoGate();
      if (!gateOk) {
        Router.show('home');
        return;
      }
      this._wasOutdoor = true;
    }
    // POI launches imply outdoor
    if (this._targetPOI) this._wasOutdoor = true;

    // Outdoor daily cap for free users
    if (this._wasOutdoor || this._targetPOI) {
      const outdoorCheck = Subscription.canStartOutdoor(p.id);
      if (!outdoorCheck.allowed) {
        this._showToast(outdoorCheck.reason);
        Router.show('home');
        return;
      }
      Subscription.recordOutdoor(p.id);
    }

    await Router.show('challenge');
    this._fill(world, challenge, stepDefs, badge, p, t);
  },

  // ─── Geo gate: silently check GPS, fall back gracefully ───
  // No blocking screen — GPS permission is handled by the OS dialog on mobile.
  async _geoGate() {
    let result;
    try {
      result = await Promise.race([
        Geo.checkOutdoor(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
      ]);
    } catch (err) {
      const lang = localStorage.getItem('gream_lang') || 'en';
      // Only toast if explicitly denied — if not just slow GPS
      if (err?.code === 1) { // GeolocationPositionError.PERMISSION_DENIED
        this._showToast(lang === 'cs'
          ? '🐍 Poloha není povolena — hr�t bez bonusu'
          : '🐍 Location not allowed — playing without bonus');
      }
      this._wasOutdoor = false;
      return true; // proceed anyway
    }
    this._wasOutdoor = !!result.outside;
    return true;
  },

  _fill(world, challenge, stepDefs, badge, p, t) {
    const stepsDone  = Profiles.getBadgeProgress(p.id, world);
    const difficulty = this._difficulty || p.difficulty || 'medium';
    const mode       = challenge.mode || 'indoor_ok';
    const lang       = localStorage.getItem('gream_lang') || 'en';

    this._set('chWorldName',  t.worlds[world]);
    this._set('chIcon',       WORLD_ICONS[world]);
    this._set('ch-label',     t.ch_label);
    this._set('chText',       challenge.text);
    this._set('chHint',       challenge.hint);
    this._set('chStepBadge',  `${badge.e} ${t.step_lbl(this._currentStep + 1)} / 3`);
    this._set('bp-title',     t.bp_title);

    // Reset hint button state for new step
    const hintBtn  = document.getElementById('chHintBtn');
    const hintText = document.getElementById('chHintText');
    const hintLbl  = document.getElementById('chHintLabel');
    if (hintBtn)  { hintBtn.classList.remove('used'); }
    if (hintText) { hintText.style.display = 'none'; }
    // Hide hint btn if no hint available
    if (hintBtn)  { hintBtn.style.display = challenge.hint ? 'inline-flex' : 'none'; }
    // Update label: show boost charges if available, else show seed cost
    if (hintLbl && challenge.hint) {
      const charges = p ? Skins.getHintCharges(p.id) : 0;
      if (charges > 0) {
        hintLbl.textContent = lang === 'cs' ? `Nápověda (${charges}×)` : `Hint (${charges}×)`;
      } else {
        hintLbl.textContent = lang === 'cs' ? 'Nápověda (-2🌱)' : 'Hint (-2🌱)';
      }
    }

    // Show outdoor bonus hint if applicable
    const modeBadgeEl = document.getElementById('chModeBadge');
    if (modeBadgeEl) {
      if (mode === 'outdoor_bonus') {
        modeBadgeEl.textContent = t.geo_outdoor_bonus;
        modeBadgeEl.style.display = 'inline-flex';
      } else if (mode === 'outdoor_required' && this._targetPOI) {
        modeBadgeEl.textContent = '🐍 ' + this._targetPOI.name;
        modeBadgeEl.style.display = 'inline-flex';
      } else {
        modeBadgeEl.style.display = 'none';
      }
    }

    const bpSteps = document.getElementById('bpSteps');
    if (bpSteps) {
      bpSteps.innerHTML = '';
      stepDefs.forEach((sd, i) => {
        const done   = i < stepsDone;
        const active = i === this._currentStep && !done;
        const div    = document.createElement('div');
        div.className = `bp-step${done ? ' done' : active ? ' active' : ''}`;
        div.innerHTML = `
          <div class="bp-step-num">${t.step_lbl(i + 1)}</div>
          <span class="bp-step-icon">${sd.icon}</span>
          <div class="bp-step-label">${sd.label}</div>
          ${done ? '<div class="bp-step-check">✓</div>' : ''}
        `;
        bpSteps.appendChild(div);
      });
    }

    const actionType = challenge.action || stepDefs[this._currentStep]?.type || 'choice';
    this._renderActionButtons(actionType, difficulty, t);

    // ─── Boost_skip button: appears if boost is active ───
    if (p && Skins.getPendingBoost(p.id) === 'boost_skip') {
      const container = document.getElementById('action-btns');
      if (container) {
        const lang = localStorage.getItem('gream_lang') || 'en';
        const skipBtn = document.createElement('button');
        skipBtn.className = 'btn-ghost';
        skipBtn.style.cssText = 'width:100%;margin-top:4px;font-size:13px;opacity:0.85';
        skipBtn.textContent = lang === 'cs' ? '⏭️ Přeskočit krok (boost)' : '⏭️ Skip step (boost)';
        skipBtn.onclick = () => {
          Skins.consumePendingBoost(p.id);
          this._completeStep();
        };
        container.appendChild(skipBtn);
      }
    }
  },

  _renderActionButtons(actionType, diff, t) {
    const container = document.getElementById('action-btns');
    if (!container) return;
    container.innerHTML = '';

    const typeMap = { photo: 'choice', draw: 'choice', voice: 'choice' };
    const type = typeMap[actionType] || actionType;
    const challenge = this._currentChallenge;

    if      (type === 'choice'     && challenge?.choices)   this._renderChoiceUI(container, challenge, t);
    else if (type === 'number')                              this._renderNumberUI(container, challenge, t);
    else if (type === 'fill_blank' && challenge?.blank)     this._renderFillBlankUI(container, challenge, t);
    else if (type === 'sort'       && challenge?.items)     this._renderSortUI(container, challenge, t);
    else if (type === 'match'      && challenge?.pairs)     this._renderMatchUI(container, challenge, t);
    else if (challenge?.choices)                             this._renderChoiceUI(container, challenge, t);
    else                                                      this._renderNumberUI(container, challenge, t);
  },
