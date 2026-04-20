// ═══════════════════════════════════
//  GREAM — challenge.js  v4
//  Fixed: voice has recording step + duration check
//  Added: parent confirm for 4-6
//  Added: draw empty check, text word count
// ═══════════════════════════════════

import { tr } from './i18n.js';
import { Profiles } from './profiles.js';
import { Badges } from './badges.js';
import { Router } from './router.js';
import { Speech } from './speech.js';
import { Camera, Draw, TextInput } from './camera.js';
import { Validator } from './validator.js';

const WORLD_ICONS = { nature:'🌿', language:'📖', logic:'🧩', feelings:'💛', arts:'🎨', world:'🌍' };

const ACTION_CFG = {
  photo: { icon:'📷', key:'btn_photo', cls:'btn-photo' },
  draw:  { icon:'🎨', key:'btn_draw',  cls:'btn-draw'  },
  voice: { icon:'🎙️', key:'btn_voice', cls:'btn-voice' },
  write: { icon:'✍️', key:'btn_write', cls:'btn-write' }
};

// Min word counts by age for written answers
const MIN_WORDS = { '4-6': 0, '7-9': 3, '10-15': 8, '15+': 15 };
// Min voice duration in ms by age
const MIN_VOICE_MS = { '4-6': 1500, '7-9': 2000, '10-15': 3000, '15+': 4000 };

export const Challenge = {
  _world:            null,
  _currentStep:      0,
  _proof:            null,
  _proofType:        null,
  _currentChallenge: null,   // full challenge object incl. check

  // ─── Open world ───
  async open(world) {
    const p = Profiles.active();
    if (!p) return;
    this._world     = world;
    this._proof     = null;
    this._proofType = null;

    const t   = tr();
    const age = p.age || '4-6';

    let challenges = t.challenges[world];
    let steps = Array.isArray(challenges)
      ? challenges
      : (challenges?.[age] || challenges?.['4-6'] || []);

    const stepsDone   = Profiles.getBadgeProgress(p.id, world);
    this._currentStep = Math.min(stepsDone, steps.length - 1);
    const challenge   = steps[this._currentStep];
    if (!challenge) return;
    this._currentChallenge = challenge;

    const stepDefs = t.steps[world] || [];
    const badge    = Badges.getBadge(world, p.worldTasks?.[world] || 0);

    await Router.show('challenge');
    this._fill(world, challenge, stepDefs, badge, p, t);

    Speech.setText(challenge.text);
    Speech.updateTTSButton(age);
    Speech.autoRead(age, challenge.text);
  },

  // ─── Fill challenge screen ───
  _fill(world, challenge, stepDefs, badge, p, t) {
    const stepsDone = Profiles.getBadgeProgress(p.id, world);
    const age = p.age || '4-6';

    this._set('chWorldName',  t.worlds[world]);
    this._set('chIcon',       WORLD_ICONS[world]);
    this._set('ch-label',     t.ch_label);
    this._set('chText',       challenge.text);
    this._set('chHint',       challenge.hint);
    this._set('chStepBadge',  `${badge.e} ${t.step_lbl(this._currentStep + 1)} / 3`);
    this._set('bp-title',     t.bp_title);

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

    const actionType = challenge.action || stepDefs[this._currentStep]?.type || 'photo';
    this._renderActionButtons(actionType, age, t);
  },

  // ─── Action buttons ───
  _renderActionButtons(actionType, age, t) {
    const container = document.getElementById('action-btns');
    if (!container) return;
    container.innerHTML = '';

    if (age === '4-6') {
      // Young kids: photo + draw + voice — simple visual choice
      ['photo', 'draw', 'voice'].forEach(a => this._addActionBtn(container, a, t));
      return;
    }

    // Older: only the primary action defined by the challenge
    this._addActionBtn(container, actionType, t);
  },

  _addActionBtn(container, actionType, t) {
    const cfg = ACTION_CFG[actionType];
    if (!cfg) return;
    const btn = document.createElement('button');
    btn.className = `btn-action ${cfg.cls}`;
    btn.style.cssText = 'width:100%;max-width:420px';
    btn.innerHTML = `${cfg.icon} <span>${t[cfg.key] || actionType}</span>`;
    btn.onclick = () => this._dispatchAction(actionType);
    container.appendChild(btn);
  },

  _addAltBtn(container, actionType, t) {
    const cfg = ACTION_CFG[actionType];
    if (!cfg) return;
    const btn = document.createElement('button');
    btn.className = 'btn-secondary';
    btn.style.cssText = 'flex:1;padding:11px 8px;font-size:13px;display:flex;align-items:center;justify-content:center;gap:5px;border-radius:var(--r-md)';
    btn.innerHTML = `${cfg.icon} <span>${t[cfg.key] || actionType}</span>`;
    btn.onclick = () => this._dispatchAction(actionType);
    container.appendChild(btn);
  },

  _dispatchAction(type) {
    switch(type) {
      case 'photo': this.handlePhoto();  break;
      case 'draw':  this.handleDraw();   break;
      case 'voice': this.handleVoice();  break;
      case 'write': this.handleWrite();  break;
    }
  },

  // ─── Central validation + proceed ───
  _validateAndProceed(proof, proofType) {
    const lang   = localStorage.getItem('gream_lang') || 'en';
    const check  = this._currentChallenge?.check;
    const result = Validator.validate(check, proof, proofType, lang);

    if (!result.passed) {
      // Show friendly feedback — not a cold alert
      this._showValidationFeedback(result.feedback, lang);
      return;
    }

    this._proof     = proof;
    this._proofType = proofType;
    this._maybeConfirmParent(() => this._completeStep());
  },

  _showValidationFeedback(message, lang) {
    // Inline feedback toast instead of alert
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

  // ─── PHOTO ───
  async handlePhoto() {
    await Camera.open(dataUrl => {
      this._validateAndProceed(dataUrl, 'image');
    });
  },

  // ─── DRAW ───
  async handleDraw() {
    await Draw.open(dataUrl => {
      // Draw.done() already checks isEmpty() — if we got here canvas has content
      this._validateAndProceed(dataUrl, 'image');
    });
  },

  // ─── VOICE ───
  handleVoice() {
    const p   = Profiles.active();
    const age = p?.age || '7-9';
    window._voiceOnComplete = (blob, durationMs) => {
      const lang   = localStorage.getItem('gream_lang') || 'en';
      // Duration check via Validator
      const check  = this._currentChallenge?.check;
      // For voice: run duration check, then if check has keywords run STT
      const minMs  = { '4-6':1500, '7-9':2000, '10-15':3000, '15+':4000 }[age] || 2000;
      const durResult = Validator.validate({ type:'duration', minMs }, durationMs, 'audio', lang);
      if (!durResult.passed) {
        this._showValidationFeedback(durResult.feedback, lang);
        return false;
      }
      this._validateAndProceed(blob ? URL.createObjectURL(blob) : null, 'audio');
      return true;
    };
    Router.show('voice-record');
  },

  // ─── WRITE ───
  async handleWrite() {
    await TextInput.open(text => {
      this._validateAndProceed(text, 'text');
    });
  },

  // ─── Parent confirmation for age 4-6 ───
  _maybeConfirmParent(onConfirm) {
    const p   = Profiles.active();
    const age = p?.age || '7-9';
    if (age !== '4-6') { onConfirm(); return; }
    // Show parent confirm screen
    window._parentOnConfirm = onConfirm;
    Router.show('parent-confirm');
  },

  // Called from parent-confirm screen
  parentConfirm()  { window._parentOnConfirm?.(); window._parentOnConfirm = null; },
  parentDeny()     {
    window._parentOnConfirm = null;
    this._proof = null;
    Router.show('challenge');
  },

  // ─── Complete step ───
  _completeStep() {
    const p = Profiles.active();
    if (!p || !this._world) return;

    const prevCount = p.worldTasks?.[this._world] || 0;
    const result    = Profiles.completeTask(p.id, this._world, this._currentStep);
    const newCount  = (Profiles.active()?.worldTasks?.[this._world] || 0);
    const evolved   = Badges.didEvolve(prevCount, newCount);

    if (result.stepsComplete) {
      this._showBadgeEarned(evolved);
    } else {
      this._showStepDone(result.stepsDone, evolved);
    }
  },

  // ─── Step done screen ───
  async _showStepDone(stepsDone, evolved) {
    const t = tr();
    await Router.show('step-done');

    const icons = ['🌱','🌿','🌳'];
    this._set('sdIcon',     icons[stepsDone - 1] || '🌟');
    this._set('sdTitle',    t.step_done_title);
    this._set('sdSub',      evolved ? `✨ ${t.badge_evolved} · ${t.step_done_sub(stepsDone, 3)}` : t.step_done_sub(stepsDone, 3));
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

    // Proof preview
    if (this._proofType === 'image' && this._proof) {
      let img = document.getElementById('sdProofImg');
      if (!img) {
        img = document.createElement('img');
        img.id = 'sdProofImg';
        img.style.cssText = 'width:100%;max-width:280px;margin:0 auto 16px;border-radius:12px;display:block;max-height:160px;object-fit:cover;box-shadow:0 4px 16px rgba(0,0,0,0.15)';
        document.querySelector('.sd-card')?.insertBefore(img, document.getElementById('sdNextBtn'));
      }
      img.src = this._proof;
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
    this._proof = null;
  },

  async nextStep() { await this.open(this._world); },

  // ─── Badge earned screen ───
  async _showBadgeEarned(evolved) {
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
    this._proof = this._proofType = null;
    this._spawnConfetti();
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
