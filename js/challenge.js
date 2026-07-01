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
    // Challenge data in i18n.js is keyed by difficulty (easy/medium/hard/extreme).
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
      // Only toast if explicitly denied — not just slow GPS
      if (err?.code === 1) { // GeolocationPositionError.PERMISSION_DENIED
        this._showToast(lang === 'cs'
          ? '📍 Poloha není povolena — hrát bez bonusu'
          : '📍 Location not allowed — playing without bonus');
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

    // Per-world painted backdrop behind the challenge cards
    const screenEl = document.getElementById('screen-challenge');
    if (screenEl) {
      screenEl.style.setProperty('--world-bg', `url('img/bg/world_${world}.jpg')`);
      screenEl.classList.add('has-world-bg');
    }

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
        modeBadgeEl.textContent = '📍 ' + this._targetPOI.name;
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

  _renderActionButtons(actionType, age, t) {
    const container = document.getElementById('action-btns');
    if (!container) return;
    container.innerHTML = '';

    const typeMap = { photo: 'choice', draw: 'choice', voice: 'choice' };
    const type = typeMap[actionType] || actionType;
    const challenge = this._currentChallenge;

    if      (type === 'choice'     && challenge?.choices)   this._renderChoiceUI(container, challenge, t);
    else if (type === 'number')                             this._renderNumberUI(container, challenge, t);
    else if (type === 'fill_blank' && challenge?.blank)     this._renderFillBlankUI(container, challenge, t);
    else if (type === 'sort'       && challenge?.items)     this._renderSortUI(container, challenge, t);
    else if (type === 'match'      && challenge?.pairs)     this._renderMatchUI(container, challenge, t);
    else if (challenge?.choices)                            this._renderChoiceUI(container, challenge, t);
    else                                                    this._renderNumberUI(container, challenge, t);
  },

  _renderChoiceUI(container, challenge, t) {
    const lang = localStorage.getItem('gream_lang') || 'en';
    const label = document.createElement('div');
    label.style.cssText = 'font-size:13px;font-weight:700;color:var(--green-mid);margin-bottom:8px;text-align:center';
    label.textContent = lang === 'cs' ? 'Vyber správnou odpověď:' : 'Choose the right answer:';
    container.appendChild(label);

    challenge.choices.forEach(choice => {
      const btn = document.createElement('button');
      btn.className = 'btn-action btn-choice';
      btn.style.cssText = 'width:100%;max-width:420px;text-align:left;padding:14px 18px;font-size:15px';
      btn.textContent = choice.text;
      btn.onclick = () => {
        // Deselect all
        container.querySelectorAll('.btn-choice').forEach(b => {
          b.style.background = '';
          b.style.borderColor = '';
        });
        // Mark selected
        btn.style.background = 'rgba(74,138,46,0.15)';
        btn.style.borderColor = 'var(--green-mid)';
        // Submit after brief pause
        setTimeout(() => {
          this._validateAndProceed(choice.value || choice.text, 'choice');
        }, 80);
      };
      container.appendChild(btn);
    });
  },

  _renderNumberUI(container, challenge, t) {
    const lang = localStorage.getItem('gream_lang') || 'en';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:100%;max-width:420px';

    const label = document.createElement('div');
    label.style.cssText = 'font-size:13px;font-weight:700;color:var(--green-mid);margin-bottom:8px;text-align:center';
    label.textContent = lang === 'cs' ? 'Napiš číslo:' : 'Enter a number:';

    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.placeholder = lang === 'cs' ? 'Tvoje odpověď...' : 'Your answer...';
    input.style.cssText = `
      width:100%;padding:16px 18px;font-size:24px;font-weight:900;
      text-align:center;border:2px solid rgba(74,138,46,0.3);
      border-radius:16px;font-family:'Nunito',sans-serif;
      color:var(--green-deep);background:white;
      box-sizing:border-box;margin-bottom:10px;outline:none;
    `;
    input.onfocus = () => { input.style.borderColor = 'var(--green-mid)'; };
    input.onblur  = () => { input.style.borderColor = 'rgba(74,138,46,0.3)'; };

    const btn = document.createElement('button');
    btn.className = 'btn-primary';
    btn.style.cssText = 'width:100%';
    btn.textContent = lang === 'cs' ? '✓ Potvrdit' : '✓ Confirm';
    btn.onclick = () => {
      const val = input.value.trim();
      if (!val) { input.style.borderColor = '#e05555'; return; }
      this._validateAndProceed(val, 'number');
    };
    input.addEventListener('keypress', e => { if (e.key === 'Enter') btn.click(); });

    wrap.appendChild(label);
    wrap.appendChild(input);
    wrap.appendChild(btn);
    container.appendChild(wrap);
    setTimeout(() => input.focus(), 300);
  },

  // ─── Fill-in-the-blank ───
  // challenge.blank = { before, after, correct, tolerance? }
  _renderFillBlankUI(container, challenge, t) {
    const lang   = localStorage.getItem('gream_lang') || 'en';
    const blank  = challenge.blank;
    const wrap   = document.createElement('div');
    wrap.style.cssText = 'width:100%;max-width:420px';

    // Sentence with input in the middle
    const sentenceEl = document.createElement('div');
    sentenceEl.style.cssText = 'font-size:16px;font-weight:700;color:var(--green-deep);text-align:center;line-height:2;margin-bottom:12px;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:6px';
    sentenceEl.textContent = blank.before + ' ';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '___';
    input.autocomplete = 'off';
    input.style.cssText = `
      display:inline-block;min-width:90px;max-width:160px;
      border:none;border-bottom:3px solid var(--green-mid);
      font-size:18px;font-weight:900;color:var(--green-deep);
      text-align:center;background:transparent;padding:4px 8px;
      font-family:'Nunito',sans-serif;outline:none;
    `;

    const after = document.createElement('span');
    after.textContent = ' ' + (blank.after || '');
    after.style.cssText = 'font-size:16px;font-weight:700;color:var(--green-deep)';

    sentenceEl.appendChild(input);
    sentenceEl.appendChild(after);

    const btn = document.createElement('button');
    btn.className = 'btn-primary';
    btn.style.cssText = 'width:100%;margin-top:8px';
    btn.textContent = lang === 'cs' ? '✓ Hotovo' : '✓ Done';
    btn.onclick = () => {
      const val = input.value.trim();
      if (!val) { input.style.borderBottomColor = '#e05555'; return; }
      this._validateAndProceed(val, 'fill_blank');
    };
    input.addEventListener('keypress', e => { if (e.key === 'Enter') btn.click(); });

    wrap.appendChild(sentenceEl);
    wrap.appendChild(btn);
    container.appendChild(wrap);
    setTimeout(() => input.focus(), 300);
  },

  // ─── Sort — tap items in correct order ───
  // challenge.items = ['A','B','C'], challenge.check.correct = ['B','A','C']
  _renderSortUI(container, challenge, t) {
    const lang  = localStorage.getItem('gream_lang') || 'en';
    const items = [...challenge.items].sort(() => Math.random() - 0.5); // shuffle
    const selected = [];
    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:100%;max-width:420px';

    const label = document.createElement('div');
    label.style.cssText = 'font-size:12px;font-weight:700;color:var(--green-mid);margin-bottom:8px;text-align:center';
    label.textContent = lang === 'cs' ? 'Klepni v správném pořadí:' : 'Tap in the correct order:';

    const orderRow = document.createElement('div');
    orderRow.style.cssText = 'display:flex;gap:6px;min-height:36px;margin-bottom:10px;flex-wrap:wrap;justify-content:center;border-bottom:2px dashed rgba(74,138,46,0.2);padding-bottom:8px';

    const itemsRow = document.createElement('div');
    itemsRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:10px';

    const updateOrder = () => {
      orderRow.innerHTML = selected.map((s, i) =>
        `<div style="padding:6px 12px;background:var(--green-mid);color:white;border-radius:50px;font-size:13px;font-weight:800">${i+1}. ${s}</div>`
      ).join('');
    };

    items.forEach(item => {
      const btn = document.createElement('button');
      btn.style.cssText = `padding:10px 16px;border-radius:14px;border:2px solid rgba(74,138,46,0.3);background:white;font-family:inherit;font-size:14px;font-weight:700;color:var(--green-deep);cursor:pointer;transition:all 0.15s`;
      btn.textContent = item;
      btn.onclick = () => {
        if (selected.includes(item)) return;
        selected.push(item);
        btn.style.opacity = '0.35';
        btn.style.pointerEvents = 'none';
        updateOrder();
        if (selected.length === items.length) {
          setTimeout(() => this._validateAndProceed(selected.join('→'), 'sort'), 80);
        }
      };
      itemsRow.appendChild(btn);
    });

    const resetBtn = document.createElement('button');
    resetBtn.style.cssText = 'background:none;border:none;font-family:inherit;font-size:12px;color:#aaa;cursor:pointer;padding:4px 0';
    resetBtn.textContent = lang === 'cs' ? '↺ Začít znovu' : '↺ Reset';
    resetBtn.onclick = () => {
      selected.length = 0;
      orderRow.innerHTML = '';
      itemsRow.querySelectorAll('button').forEach(b => { b.style.opacity = '1'; b.style.pointerEvents = 'auto'; });
    };

    wrap.appendChild(label);
    wrap.appendChild(orderRow);
    wrap.appendChild(itemsRow);
    wrap.appendChild(resetBtn);
    container.appendChild(wrap);
  },

  // ─── Match — tap pairs ───
  // challenge.pairs = [{a:'Dog', b:'Pes'}, ...]
  _renderMatchUI(container, challenge, t) {
    const lang  = localStorage.getItem('gream_lang') || 'en';
    const pairs = challenge.pairs;
    const matched = new Set();
    let selectedA = null, selectedB = null;

    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:100%;max-width:420px';

    const label = document.createElement('div');
    label.style.cssText = 'font-size:12px;font-weight:700;color:var(--green-mid);margin-bottom:10px;text-align:center';
    label.textContent = lang === 'cs' ? 'Spoj správné dvojice:' : 'Match the correct pairs:';

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px';

    const colA = document.createElement('div');
    colA.style.cssText = 'display:flex;flex-direction:column;gap:6px';
    const colB = document.createElement('div');
    colB.style.cssText = 'display:flex;flex-direction:column;gap:6px';

    // Shuffle column B
    const shuffledB = [...pairs].sort(() => Math.random() - 0.5);

    const checkComplete = () => {
      if (matched.size === pairs.length) {
        setTimeout(() => this._validateAndProceed('matched:' + pairs.length, 'match'), 80);
      }
    };

    const tryMatch = () => {
      if (!selectedA || !selectedB) return;
      const pair = pairs.find(p => p.a === selectedA.dataset.val);
      const correct = pair && pair.b === selectedB.dataset.val;
      if (correct) {
        selectedA.style.background = 'var(--green-mid)';
        selectedA.style.color = 'white';
        selectedA.style.pointerEvents = 'none';
        selectedB.style.background = 'var(--green-mid)';
        selectedB.style.color = 'white';
        selectedB.style.pointerEvents = 'none';
        matched.add(pair.a);
        Feedback.pop();
        checkComplete();
      } else {
        selectedA.style.background = '#ffeeee';
        selectedB.style.background = '#ffeeee';
        setTimeout(() => {
          [selectedA, selectedB].forEach(b => { if (b) b.style.background = 'white'; });
        }, 500);
        Feedback.error();
      }
      selectedA = selectedB = null;
    };

    const makeBtn = (text, val, col, isB) => {
      const btn = document.createElement('button');
      btn.dataset.val = val;
      btn.style.cssText = `padding:10px 12px;border-radius:12px;border:2px solid rgba(74,138,46,0.25);background:white;font-family:inherit;font-size:13px;font-weight:700;color:var(--green-deep);cursor:pointer;text-align:left;transition:all 0.15s;width:100%`;
      btn.textContent = text;
      btn.onclick = () => {
        // Deselect in same column
        col.querySelectorAll('button').forEach(b => b.style.borderColor = 'rgba(74,138,46,0.25)');
        btn.style.borderColor = 'var(--green-mid)';
        btn.style.borderWidth = '3px';
        if (!isB) selectedA = btn; else selectedB = btn;
        tryMatch();
      };
      return btn;
    };

    pairs.forEach(p => colA.appendChild(makeBtn(p.a, p.a, colA, false)));
    shuffledB.forEach(p => colB.appendChild(makeBtn(p.b, p.b, colB, true)));

    grid.appendChild(colA);
    grid.appendChild(colB);
    wrap.appendChild(label);
    wrap.appendChild(grid);
    container.appendChild(wrap);
  },

  // ─── Validate & proceed ───
  async _validateAndProceed(proof, proofType) {
    // Double-click / re-entry guard
    if (this._validating) return;
    this._validating = true;

    // Disable all interactive elements immediately
    const allBtns = document.querySelectorAll('#screen-challenge button, #screen-challenge input, #screen-challenge textarea');
    allBtns.forEach(el => { el._wasDisabled = el.disabled; el.disabled = true; });
    const _release = () => {
      this._validating = false;
      allBtns.forEach(el => { el.disabled = !!el._wasDisabled; });
    };

    const lang   = localStorage.getItem('gream_lang') || 'en';
    const check  = this._currentChallenge?.check;
    const result = Validator.validate(check, proof, proofType, lang);
    const score  = Validator.score(check, proof, proofType);
    this._lastScore = score;

    // Hard fail only if existence check fails — otherwise proceed with reduced reward
    if (!result.passed && check?.type === 'exists') {
      Feedback.error();
      const card = document.querySelector('.card');
      if (card) Feedback.flashError(card);
      this._showToast(result.feedback);
      _release();
      return;
    }

    // Choice wrong answer: deduct seeds, kick back to home, try again
    if (!result.passed && check?.type === 'choice') {
      this._wrongCount = (this._wrongCount || 0) + 1;
      Feedback.error();
      const card = document.querySelector('.card');
      if (card) Feedback.flashError(card);
      this._validating = false;

      const WRONG_PENALTY = 3;
      const p = (await import('./profiles.js').then(m => m.Profiles)).active();
      let penaltyApplied = false;
      let remaining = 0;
      if (p) {
        const { Skins } = await import('./skins.js');
        penaltyApplied = Skins.spendSeeds(p.id, WRONG_PENALTY);
        remaining = Skins.getSeeds(p.id);
      }
      const msg = lang === 'cs'
        ? penaltyApplied ? `❌ Špatně! −${WRONG_PENALTY} semínka (zbývá ${remaining}). Zkus jinou otázku.` : `❌ Špatně! Zkus jinou otázku.`
        : penaltyApplied ? `❌ Wrong! −${WRONG_PENALTY} seeds (${remaining} left). Try a different question.` : `❌ Wrong! Try a different question.`;

      setTimeout(() => {
        this._showToast(msg);
        setTimeout(() => Router.show('home'), 1200);
      }, 300);
      return;
    }

    // Soft fail with very low score → encourage retry but allow proceed
    if (score < 20) {
      Feedback.error();
      const card = document.querySelector('.card');
      if (card) Feedback.flashError(card);
      this._showToast(result.feedback || (lang === 'cs' ? 'Zkus napsat trochu víc!' : 'Try writing a bit more!'));
      _release();
      return;
    }

    // ─── POI proximity check (only if challenge was started from a POI pin) ───
    if (this._targetPOI) {
      try {
        const r = await Geo.checkAtPOI(this._targetPOI, 50); // 50m tolerance
        if (!r.atPOI) {
          Feedback.error();
          const t = tr();
          this._showToast(`${t.geo_walk_to} ${this._targetPOI.name} (${r.dist || '?'} m)`);
          _release();
          return;
        }
      } catch {
        // GPS unavailable — accept anyway, don't block
      }
    }

    // Outdoor bonus check (post-proof)
    if (this._currentChallenge?.mode === 'outdoor_bonus' && !this._wasOutdoor) {
      try {
        const p = Profiles.active();
        const r = await Geo.checkOutdoor();
        if (r.outside) this._wasOutdoor = true;
      } catch {}
    }

    Feedback.success();
    // Tag proof with location so we have provenance later
    try {
      const tagged = await Geo.tagWithLocation(proof);
      this._proofGeo = tagged.geo;
    } catch {}
    this._proof     = proof;
    this._proofType = proofType;

    setTimeout(() => {
      this._completeStep();
    }, 0);
  },

  _showToast(message) {
    const existing = document.getElementById('gream-feedback-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'gream-feedback-toast';
    toast.style.cssText = `
      position:fixed; bottom:120px; left:50%; transform:translateX(-50%);
      background:#1a3d0a; color:white; padding:14px 22px;
      border-radius:50px; font-family:'Nunito',sans-serif;
      font-size:15px; font-weight:700; z-index:999;
      box-shadow:0 4px 20px rgba(0,0,0,0.3);
      max-width:320px; text-align:center; line-height:1.4;
      animation:slideUp 0.3s ease both;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  },


  // ─── Complete step ───
  async _completeStep() {
    const p = Profiles.active();
    if (!p || !this._world) return;

    const prevCount = p.worldTasks?.[this._world] || 0;
    const meta = {
      outdoor: this._wasOutdoor,
      geo:     this._proofGeo || null,
      poiName: this._targetPOI?.name || null
    };
    const result    = Profiles.completeTask(p.id, this._world, this._currentStep, meta);
    if (!result) return;
    const fresh     = Profiles.active();
    const newCount  = (fresh?.worldTasks?.[this._world] || 0);
    const evolved   = Badges.didEvolve(prevCount, newCount);

    // ─── Award seeds (score × difficulty × boost_2x) ───
    // easy=2, medium=3, hard=5, extreme=8 per step at perfect score
    const DIFF_MULT = { easy: 1.0, medium: 1.5, hard: 2.5, extreme: 4.0 };
    const scoreMultiplier = (this._lastScore || 100) / 100;
    const diffMultiplier  = DIFF_MULT[this._difficulty || p.difficulty || 'medium'] || 1.5;
    const activeBoost     = Skins.consumePendingBoost(p.id);
    const boostMultiplier = (activeBoost === 'boost_2x') ? 2 : 1;
    Skins.awardForTask(p.id, this._wasOutdoor, scoreMultiplier * diffMultiplier * boostMultiplier);
    const lang = localStorage.getItem('gream_lang') || 'en';
    if (activeBoost === 'boost_2x') {
      setTimeout(() => this._showToast(lang === 'cs' ? '✨ 2× semínka aktivní!' : '✨ 2× seeds boost!'), 400);
    }
    if (result.stepsComplete) Skins.awardForBadge(p.id);
    Feedback.egg();

    // ─── Feed the Gream ───
    const greamResult = Gream.feedFromTask(p.id, this._world, this._wasOutdoor);

    // ─── Archetype reveal overlay at hatching ───
    if (greamResult?.archetypeResolved && greamResult.resolvedArchetype) {
      setTimeout(() => this._showArchetypeReveal(greamResult), 600);
    }

    // ─── Mark POI done for this world + bonus eggs if matching world ───
    if (this._targetPOI) {
      const selectedWorld = this._targetPOI.selectedWorld || this._world;
      Geo.markPOIDone(this._targetPOI.id, selectedWorld);
      // Bonus eggs if user played the matching bonus world at this POI
      const bonusSeeds = (this._targetPOI.bonusWorld === selectedWorld) ? 5 : 0;
      if (bonusSeeds > 0 && result.stepsComplete) {
        const lang = localStorage.getItem('gream_lang') || 'en';
        setTimeout(() => this._showToast(lang === 'cs' ? `🌟 +5 semínek za správné místo!` : `🌟 +5 bonus seeds for the right spot!`), 600);
      }
      // Celebrate on map (glow animation)
      if (window.MapView && result.stepsComplete) {
        try { MapView.celebratePOI(this._targetPOI.id, selectedWorld); } catch {}
      }
    }

    // ─── Check skin unlocks ───
    const newlyUnlocked = Skins.checkUnlocks(p.id);

    // 5% egg drop on perfect (no wrong answers) full badge completion
    if (result.stepsComplete && (this._wrongCount || 0) === 0 && Math.random() < 0.05) {
      const { Gream: G } = await import('./gream.js');
      const newEgg = G.dropEgg(p.id);
      if (newEgg) {
        const lang = localStorage.getItem('gream_lang') || 'cs';
        setTimeout(() => this._showToast(
          lang === 'cs' ? '🥚 Záhadné vajíčko se přidalo do tvé zahrady!' : '🥚 A mystery egg appeared in your garden!'
        ), 2500);
      }
    }

    if (result.stepsComplete) {
      Feedback.celebrate();
      this._showBadgeEarned(evolved, newlyUnlocked, greamResult);
      // Notify that a new Greamík slot has unlocked
      if (greamResult?.nextGreamUnlocked) {
        setTimeout(() => {
          const lang = localStorage.getItem('gream_lang') || 'en';
          this._showToast(lang === 'cs'
            ? '🎊 Můžeš přidat druhého Greamíka! Jdi do Šatníku.'
            : '🎊 You can add a second Gream! Go to Wardrobe.');
        }, 3000);
      }
    } else {
      Feedback.stepDone();
      // Gream evolved? Special evolve sound
      if (greamResult?.evolved) Feedback.evolve();
      this._showStepDone(result.stepsDone, evolved, newlyUnlocked, greamResult);
    }
  },

  // ─── Step done screen ───
  async _showStepDone(stepsDone, evolved, newlyUnlocked = [], greamResult = null) {
    const t = tr();
    await Router.show('step-done');

    const icons = ['🌱','🌿','🌳'];
    this._set('sdIcon',     icons[stepsDone - 1] || '🌟');
    this._set('sdTitle',    t.step_done_title);

    let sub = t.step_done_sub(stepsDone, 3);
    if (evolved) sub = `✨ ${t.badge_evolved} · ${sub}`;
    if (this._wasOutdoor) sub += ` · ${t.geo_outdoor_bonus}`;
    this._set('sdSub', sub);

    this._set('sdNextBtn',  t.next_step);
    this._set('sdLaterBtn', t.come_back);

    const dots = document.getElementById('sdDots');
    if (dots) {
      dots.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        const d = document.createElement('div');
        d.className = 'sd-dot' + (i < stepsDone ? ' done' : i === stepsDone ? ' next' : '');
        dots.appendChild(d);
      }
    }

    this._renderProofPreview();
    this._renderUnlocks(newlyUnlocked);
    this._renderGreamGrowth(greamResult);
    this._proof = null;
  },

  // ─── Prompt for Greamík name (after stage 2 evolution) ───
  _promptGreamName(gream) {
    const lang = localStorage.getItem('gream_lang') || 'cs';
    const overlay = document.createElement('div');
    overlay.id = 'nameOverlay';
    overlay.style.cssText = `
      position:fixed; inset:0; background:rgba(15,42,7,0.7);
      display:flex; align-items:center; justify-content:center;
      z-index:1001; padding:20px;
      animation:slideUp 0.3s ease both;
    `;

    const title = lang === 'cs' ? 'Tvůj Greamík je tu! 🎉' : 'Your Gream is here! 🎉';
    const sub   = lang === 'cs' ? 'Vyrostl/a. Jak ho budeš oslovovat?' : 'It grew up. What do you want to call them?';
    const btnSave = lang === 'cs' ? 'Pojmenovat' : 'Name it';
    const btnSkip = lang === 'cs' ? 'Později' : 'Later';
    const placeholder = lang === 'cs' ? 'Třeba Mech, Liška, Luna...' : 'Like Moss, Fox, Luna...';

    const card = document.createElement('div');
    card.style.cssText = `
      background:white; border-radius:24px; padding:24px; max-width:320px; width:100%;
      box-shadow:0 10px 30px rgba(0,0,0,0.3); text-align:center;
    `;
    card.innerHTML = `
      ${gream.archetype
        ? `<canvas data-sprite-sheet="img/greamici/${gream.archetype}_${gream.stage}.png" data-sprite-mood="happy"
             width="96" height="96"
             style="width:96px;height:96px;image-rendering:pixelated;display:block;margin:0 auto 12px"></canvas>`
        : `<div style="font-size:64px;text-align:center;margin:0 auto 12px">🥚</div>`
      }
      <h3 style="font-size:18px;font-weight:900;color:var(--green-deep);margin:0 0 6px">${title}</h3>
      <p style="font-size:13px;color:var(--green-mid);font-weight:600;margin:0 0 16px;line-height:1.4">${sub}</p>
      <input type="text" id="greamNameInput" maxlength="20" placeholder="${placeholder}"
        style="width:100%;padding:12px 14px;border:2px solid rgba(74,138,46,0.3);border-radius:12px;
        font-family:'Nunito',sans-serif;font-size:15px;font-weight:700;color:var(--green-deep);
        text-align:center;margin-bottom:14px;outline:none;box-sizing:border-box">
      <button id="greamNameSave" class="btn-primary" style="width:100%;margin-bottom:8px">${btnSave}</button>
      <button id="greamNameSkip" class="btn-ghost" style="width:100%">${btnSkip}</button>
    `;
    overlay.appendChild(card);
    if (window.App?._initSpriteCanvases) App._initSpriteCanvases(overlay);
    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('greamNameInput')?.focus(), 200);

    const save = () => {
      const name = document.getElementById('greamNameInput')?.value.trim();
      if (name) {
        const p = Profiles.active();
        if (p) {
          import('./gream.js').then(m => {
            m.Gream.setName(p.id, gream.id, name);
            Feedback.celebrate();
            overlay.remove();
          });
        }
      }
    };
    document.getElementById('greamNameSave').onclick = save;
    document.getElementById('greamNameInput').addEventListener('keypress', e => {
      if (e.key === 'Enter') save();
    });
    document.getElementById('greamNameSkip').onclick = () => {
      Feedback.tap();
      overlay.remove();
    };
  },
  _renderGreamGrowth(greamResult) {
    if (!greamResult || !greamResult.gream) return;
    // Only show banner on actual evolution — not on every step
    if (!greamResult.evolved) return;
    // Archetype reveal overlay handles the hatching moment separately
    if (greamResult.archetypeResolved) return;

    const lang = localStorage.getItem('gream_lang') || 'cs';
    const card = document.querySelector('.sd-card') || document.querySelector('.card');
    if (!card) return;

    const banner = document.createElement('div');
    banner.style.cssText = `
      display:flex; align-items:center; gap:12px;
      padding:12px 16px; margin:14px auto 0; max-width:340px;
      background:linear-gradient(135deg, rgba(135,194,109,0.2), rgba(74,138,46,0.2));
      border:2px solid rgba(74,138,46,0.4); border-radius:14px;
      animation:slideUp 0.5s ease 0.3s both;
    `;

    // Show sprite — egg image if not yet hatched, otherwise archetype
    const arch = greamResult.gream.archetype;
    const spriteSrc = spritePath(arch, greamResult.gream.stage);
    const sprite = document.createElement('img');
    sprite.src = spriteSrc;
    sprite.style.cssText = 'width:48px;height:48px;image-rendering:pixelated';
    sprite.onerror = () => { sprite.style.fontSize = '36px'; sprite.textContent = '🥚'; };
    if (greamResult.isShiny) sprite.style.filter = 'drop-shadow(0 0 6px gold)';
    banner.appendChild(sprite);

    const text = document.createElement('div');
    text.style.cssText = 'flex:1;text-align:left;font-weight:800;color:var(--green-deep)';
    if (greamResult.evolved) {
      const evolvedText = lang === 'cs' ? 'Tvůj Greamík vyrostl! 🎉' : 'Your Gream evolved! 🎉';
      const shinyText = greamResult.isShiny ? (lang === 'cs' ? '✨ A je VZÁCNÝ!' : '✨ And it\'s SHINY!') : '';
      text.innerHTML = `<div>${evolvedText}</div>${shinyText ? `<div style="font-size:12px;color:#d4a800">${shinyText}</div>` : ''}`;
    } else {
      const feedEmoji = !arch ? '🌱' : '💚';
      const fedText = lang === 'cs' ? `Vajíčko se rozvíjí ${feedEmoji}` : `Egg is growing ${feedEmoji}`;
      text.innerHTML = `<div style="font-size:13px">${!arch ? fedText : (lang === 'cs' ? 'Greamík dostal péči 💚' : 'Gream got care 💚')}</div>`;
    }
    banner.appendChild(text);
    card.appendChild(banner);
  },

  // ─── Archetype reveal: fullscreen moment when egg hatches ───
  _showArchetypeReveal(greamResult) {
    const lang = localStorage.getItem('gream_lang') || 'cs';
    const arch = greamResult.resolvedArchetype;
    // World titles — same meaning in CS and EN
    const worldTitles = {
      cs: { lilek:'Přírodní duch 🌿', jiskra:'Jazykový plamen ✨', kamen:'Logický strážce 🧩', srodik:'Citový průvodce 💛', vlnka:'Umělecká duše 🎨', atlas:'Světový badatel 🌍' },
      en: { lilek:'Nature Spirit 🌿', jiskra:'Language Flame ✨', kamen:'Logic Guardian 🧩', srodik:'Feelings Guide 💛', vlnka:'Art Soul 🎨', atlas:'World Explorer 🌍' }
    };
    // Suggested names — short, neutral, same for CS/EN
    const suggested = { lilek:['Sprout','Fern','Mossy'], jiskra:['Echo','Spark','Buzz'], kamen:['Cog','Byte','Pip'], srodik:['Blush','Rosy','Wink'], vlnka:['Hue','Dab','Ripple'], atlas:['Roam','Scout','Arc'] };
    const archTitle = worldTitles[lang]?.[arch] || '';
    const defaultName = (suggested[arch] || ['Gream'])[Math.floor(Math.random() * 3)];

    const overlay = document.createElement('div');
    overlay.id = 'archRevealOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,42,7,0.92);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:1000;padding:24px;animation:fadeIn 0.4s ease';
    overlay.innerHTML = `
      <div style="text-align:center;max-width:320px;width:100%">
        <div style="font-size:14px;font-weight:800;color:rgba(255,255,255,0.6);letter-spacing:2px;text-transform:uppercase;margin-bottom:16px;animation:slideUp 0.4s ease 0.1s both">
          ${lang === 'cs' ? 'Vajíčko se vylíhlo!' : 'Your egg has hatched!'}
        </div>
        <canvas data-sprite-sheet="img/greamici/${arch}_2.png" data-sprite-mood="happy"
          width="120" height="120"
          style="width:120px;height:120px;image-rendering:pixelated;display:block;margin:0 auto 12px;animation:scaleIn 0.5s cubic-bezier(0.2,0.8,0.3,1.2) 0.3s both,greamIdle 2s ease-in-out 0.8s infinite"></canvas>
        <div style="font-size:20px;font-weight:900;color:white;margin-bottom:6px;animation:slideUp 0.4s ease 0.5s both">${defaultName}</div>
        <div style="font-size:14px;font-weight:700;color:rgba(135,194,109,0.9);margin-bottom:8px;animation:fadeIn 0.3s ease 0.65s both">${archTitle}</div>
        ${greamResult.isShiny ? `<div style="font-size:13px;font-weight:800;color:#f5d020;margin-bottom:14px">✨ ${lang === 'cs' ? 'A je VZÁCNÝ!' : "And it's SHINY!"}</div>` : ''}
        <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:20px;animation:fadeIn 0.3s ease 0.8s both">
          ${lang === 'cs' ? '(Klepni na jméno v zahradě pro přejmenování)' : '(Tap the name in garden to rename)'}
        </div>
        <button id="archRevealBtn" style="padding:14px 32px;border-radius:50px;border:none;background:var(--green-mid,#4a8a2e);color:white;font-family:inherit;font-weight:800;font-size:16px;cursor:pointer;box-shadow:0 4px 20px rgba(74,138,46,0.4);animation:popIn 0.4s cubic-bezier(0.2,0.8,0.3,1.2) 0.95s both">
          ${lang === 'cs' ? '🌱 Pojďme na to!' : '🌱 Let\u2019s go!'}
        </button>
      </div>
    `;

    // Auto-assign generated name — user can rename by tapping the name in garden
    const p = Profiles.active();
    if (p) {
      const allGreams = Gream.all(p.id);
      const thisGream = allGreams.find(g => g.archetype === arch && !g.name);
      if (thisGream) Gream.rename(p.id, thisGream.id, defaultName);
    }

    overlay.querySelector('#archRevealBtn').onclick = () => overlay.remove();

    if (window.App?._initSpriteCanvases) App._initSpriteCanvases(overlay);
    document.body.appendChild(overlay);
    try { Feedback.celebrate(); } catch {}
  },

  async nextStep() { await this.open(this._world); },

  // ─── boost_lucky: show difficulty picker overlay ───
  _pickDifficultyOverlay(lang) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:999;padding:20px';
      const levels = [
        { id: 'easy',    label: lang === 'cs' ? '🟢 Snadné'   : '🟢 Easy' },
        { id: 'medium',  label: lang === 'cs' ? '🟡 Střední'  : '🟡 Medium' },
        { id: 'hard',    label: lang === 'cs' ? '🔴 Těžké'    : '🔴 Hard' },
        { id: 'extreme', label: lang === 'cs' ? '⚡ Extrémní' : '⚡ Extreme' },
      ];
      overlay.innerHTML = `
        <div style="background:white;border-radius:20px;padding:24px;max-width:320px;width:100%;text-align:center">
          <div style="font-size:32px;margin-bottom:8px">🍀</div>
          <div style="font-size:16px;font-weight:800;color:var(--green-deep);margin-bottom:6px">${lang === 'cs' ? 'Šťastný úkol!' : 'Lucky task!'}</div>
          <div style="font-size:13px;color:#666;margin-bottom:16px">${lang === 'cs' ? 'Vyber obtížnost:' : 'Choose difficulty:'}</div>
          ${levels.map(l => `<button data-lvl="${l.id}" style="width:100%;padding:12px;border-radius:12px;border:2px solid rgba(74,138,46,0.2);background:white;font-family:inherit;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:8px">${l.label}</button>`).join('')}
        </div>`;
      overlay.querySelectorAll('button[data-lvl]').forEach(btn => {
        btn.onclick = () => { overlay.remove(); resolve(btn.dataset.lvl); };
      });
      document.body.appendChild(overlay);
    });
  },

  // ─── Badge earned screen ───
  async _showBadgeEarned(evolved, newlyUnlocked = [], greamResult = null) {
    const p = Profiles.active();
    if (!p) return;
    const t     = tr();
    const count = p.worldTasks?.[this._world] || 0;
    const badge = Badges.getBadge(this._world, count);

    await Router.show('badge-earned');
    this._set('b-congrats',       t.congrats);
    this._set('b-sub',            evolved ? t.badge_evolved : t.badge_earned);
    this._set('earnedEmoji',      badge.e);
    this._set('earnedName',       badge.n);
    this._set('btn-continue-lbl', t.continue);

    const img = document.getElementById('proofImg');
    if (img) {
      if (this._proofType === 'image' && this._proof) {
        img.src = this._proof; img.classList.add('vis');
      } else { img.classList.remove('vis'); }
    }
    this._renderUnlocks(newlyUnlocked);
    this._renderGreamGrowth(greamResult);
    this._proof = this._proofType = null;
    this._spawnConfetti();
  },

  // ─── Render newly unlocked skins ───
  _renderUnlocks(newlyUnlocked) {
    if (!newlyUnlocked || newlyUnlocked.length === 0) return;
    const t = tr();
    const skin = newlyUnlocked[0]; // show first one
    const banner = document.createElement('div');
    banner.className = 'unlock-banner';
    banner.style.cssText = `
      display:flex; align-items:center; justify-content:center; gap:10px;
      padding:10px 16px; margin:12px auto 0; max-width:320px;
      background:linear-gradient(135deg, rgba(245,166,35,0.18), rgba(74,138,46,0.18));
      border:2px solid rgba(245,166,35,0.4); border-radius:14px;
      font-size:14px; font-weight:800; color:var(--green-deep);
      animation:slideUp 0.5s ease 0.4s both;
    `;
    banner.innerHTML = `
      <span style="font-size:28px">${skin.emoji}</span>
      <div style="text-align:left">
        <div style="font-size:11px; opacity:0.7">${t.ward_unlocked}</div>
        <div>${skin.name?.[localStorage.getItem('gream_lang') || 'en'] || skin.id}</div>
      </div>
    `;
    const card = document.querySelector('.sd-card') || document.querySelector('.card');
    if (card) card.appendChild(banner);
  },

  _renderProofPreview() {
    const existingImg = document.getElementById('sdProofImg');
    if (this._proofType === 'image' && this._proof) {
      let img = existingImg;
      if (!img) {
        img = document.createElement('img');
        img.id = 'sdProofImg';
        img.style.cssText = 'width:100%;max-width:280px;margin:0 auto 16px;border-radius:12px;display:block;max-height:160px;object-fit:cover;box-shadow:0 4px 16px rgba(0,0,0,0.15)';
        document.querySelector('.sd-card')?.insertBefore(img, document.getElementById('sdNextBtn'));
      }
      img.src = this._proof;
      img.style.display = 'block';
    } else if (this._proofType === 'text' && this._proof) {
      let box = document.getElementById('sdProofText');
      if (!box) {
        box = document.createElement('div');
        box.id = 'sdProofText';
        box.style.cssText = 'width:100%;max-width:280px;margin:0 auto 16px;padding:14px 16px;background:rgba(255,255,255,0.8);border-radius:12px;font-size:14px;line-height:1.6;color:var(--green-deep);text-align:left;border:1px solid rgba(0,0,0,0.08)';
        document.querySelector('.sd-card')?.insertBefore(box, document.getElementById('sdNextBtn'));
      }
      box.textContent = this._proof;
    }
  },

  _spawnConfetti() {
    const wrap = document.getElementById('confettiWrap');
    if (!wrap) return;
    wrap.innerHTML = '';
    const cols = ['#4a8a2e','#f5a623','#ff8fab','#87ceeb','#8a4abc','#ffd166'];
    for (let i = 0; i < 64; i++) {
      const el = document.createElement('div');
      el.className = 'confetto';
      el.style.cssText = `left:${Math.random()*100}%;background:${cols[~~(Math.random()*cols.length)]};width:${6+Math.random()*10}px;height:${6+Math.random()*10}px;border-radius:${Math.random()>.5?'50%':'2px'};animation-duration:${1.5+Math.random()*2}s;animation-delay:${Math.random()*0.8}s;`;
      wrap.appendChild(el);
    }
  },

  _set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
};
