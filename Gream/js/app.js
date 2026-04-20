// ═══════════════════════════════════
//  GREAM — app.js
//  Main controller, global App object
// ═══════════════════════════════════

import { getLang, setLang, tr } from './i18n.js';
import { Profiles } from './profiles.js';
import { Badges } from './badges.js';
import { Router } from './router.js';
import { Challenge } from './challenge.js';
import { Camera, Draw, TextInput } from './camera.js';
import { Speech } from './speech.js';
import { Stats } from './stats.js';

// ─── Register service worker ───
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ─── WORLD constants ───
const WORLDS = ['nature','language','logic','feelings','arts','world'];
const WORLD_ICONS = { nature:'🌿', language:'📖', logic:'🧩', feelings:'💛', arts:'🎨', world:'🌍' };
let _obAge = '4-6', _obAv = '🧒';

// ═══════════════════════════════════
//  App — global namespace (window.App)
// ═══════════════════════════════════
window.App = {

  async init() {
    this._syncLangBtns();
    const profiles = Profiles.all();
    const active   = Profiles.active();
    if (active) this.applyTheme(active.age);
    if (!profiles.length)        { await Router.show('onboarding'); }
    else if (active)             { await Router.show('map'); }
    else                         { await Router.show('profiles'); }
  },

  // ─── Apply age theme to body ───
  applyTheme(age) {
    const map = { '4-6':'age-4-6', '7-9':'age-7-9', '10-15':'age-10-15', '15+':'age-15plus' };
    const cls = map[age] || 'age-7-9';
    document.body.className = document.body.className.replace(/\bage-[\w-]+/g,'').trim();
    document.body.classList.add(cls);
    Speech.updateTTSButton(age);
  },

  // ─── Navigation ───
  async goTo(screen, data) { await Router.show(screen, data); },

  // ─── Language ───
  setLang(l) {
    setLang(l);
    const p = Profiles.active();
    if (p) Profiles.update(p.id, { lang: l });
    this._syncLangBtns();
    Router.show(Router.current() || 'map');
  },

  _syncLangBtns() {
    const l = getLang();
    document.getElementById('glEN')?.classList.toggle('active', l === 'en');
    document.getElementById('glCZ')?.classList.toggle('active', l === 'cs');
  },

  // ─── ONBOARDING ───
  renderOnboarding() {
    const t = tr();
    this._setText('ob-tagline',  t.tagline);
    this._setText('ob-name-lbl', t.ob_name);
    this._setAttr('nameInput', 'placeholder', t.ob_placeholder);
    this._setText('ob-av-lbl',  t.ob_av);
    this._setText('ob-age-lbl', t.ob_age);
    this._setText('btnOb',      t.ob_start);
    this._syncLangBtns();
    this.validateOb();
  },

  setObAge(age, btn) {
    _obAge = age;
    document.querySelectorAll('.age-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // Live preview of theme
    this.applyTheme(age);
    // Show age description
    const lang2 = getLang();
    const descs = {
      en: { '4-6':'Big buttons · auto voice · illustrations', '7-9':'Playful · colorful · full world map', '10-15':'Clean dark UI · stats · fast', '15+':'Minimal · calm · journal style' },
      cs: { '4-6':'Velká tlačítka · hlas · ilustrace', '7-9':'Hravé · barevné · celá mapa', '10-15':'Tmavé UI · statistiky · rychlé', '15+':'Minimální · klidné · deníkový styl' }
    };
    const preview = document.getElementById('obAgePreview');
    if (preview) preview.textContent = descs[lang2]?.[age] || '';
  },

  pickAvatar(el, emoji) {
    _obAv = emoji || el.dataset.av;
    document.querySelectorAll('.av-opt').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
  },

  async pickAvatarPhoto() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        _obAv = '__photo__';
        window._pendingPhoto = ev.target.result;
        // Preview
        const btn = document.querySelector('.av-photo-btn');
        if (btn) { btn.innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`; }
        document.querySelectorAll('.av-opt').forEach(b => b.classList.remove('active'));
      };
      reader.readAsDataURL(file);
    };
    input.click();
  },

  validateOb() {
    const v = document.getElementById('nameInput')?.value.trim();
    const btn = document.getElementById('btnOb');
    if (btn) btn.disabled = !v;
  },

  async createProfile() {
    const name = document.getElementById('nameInput')?.value.trim();
    if (!name) return;
    const p = Profiles.create({ name, avatar: _obAv === '__photo__' ? '🧒' : _obAv, age: _obAge, lang: getLang() });
    if (_obAv === '__photo__' && window._pendingPhoto) {
      Profiles.savePhoto(p.id, window._pendingPhoto);
      window._pendingPhoto = null;
    }
    document.getElementById('nameInput').value = '';
    this.applyTheme(_obAge);
    await Router.show('map');
  },

  // ─── PROFILES ───
  async renderProfiles() {
    const t = tr();
    this._setText('ps-title', t.ps_title);
    this._setText('ps-sub',   t.ps_sub);
    this._setText('btnAdd',   t.ps_add);
    this._setText('lbl-set',  t.settings);

    const list = document.getElementById('profilesList');
    if (!list) return;
    list.innerHTML = '';
    const profiles = Profiles.all();
    const activeId = Profiles.active()?.id;

    if (!profiles.length) {
      list.innerHTML = `<div style="text-align:center;padding:22px;font-size:14px;color:var(--green-mid);font-weight:700">
        ${getLang()==='cs'?'Zatím žádný profil':'No profiles yet — add one!'}</div>`;
      return;
    }

    profiles.forEach(p => {
      const card = document.createElement('div');
      card.className = 'profile-card' + (p.id === activeId ? ' active' : '');
      const title = Profiles.getTitle(p);
      const avEl  = Profiles.renderAvatar(p);
      card.appendChild(avEl);
      card.innerHTML += `
        <div style="flex:1;min-width:0">
          <div class="p-name">${p.name}</div>
          ${title ? `<div class="p-title">${title}</div>` : ''}
          <div class="p-meta">${p.age} · ${(p.worldTasks ? Object.values(p.worldTasks).reduce((a,b)=>a+b,0) : 0)} tasks</div>
        </div>
        <div class="p-streak">🔥 ${p.streak || 0}</div>
      `;
      card.onclick = () => this.selectProfile(p.id);
      list.appendChild(card);
    });
  },

  async selectProfile(id) {
    Profiles.setActive(id);
    const p = Profiles.all().find(x => x.id === id);
    if (p?.lang) { setLang(p.lang); this._syncLangBtns(); }
    if (p?.age)  { this.applyTheme(p.age); }
    await Router.show('map');
  },

  // ─── MAP ───
  async renderMap() {
    const p = Profiles.active();
    if (!p) return Router.show('profiles');
    Profiles.checkStreak(p.id);
    const t = tr();
    const fresh = Profiles.active(); // re-fetch after streak update

    // Avatar
    const mapAvEl = document.getElementById('mapAv');
    if (mapAvEl) {
      if (fresh.hasPhoto) {
        const photo = Profiles.getPhoto(fresh.id);
        if (photo) mapAvEl.innerHTML = `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
        else mapAvEl.textContent = fresh.avatar || '🧒';
      } else { mapAvEl.textContent = fresh.avatar || '🧒'; }
    }

    // Age-aware greeting
    const hours = new Date().getHours();
    const greetings = {
      en: {
        '4-6':   hours < 12 ? `Good morning, ${fresh.name}! 🌞` : hours < 18 ? `Hi ${fresh.name}! 👋` : `Good evening, ${fresh.name}! 🌙`,
        '7-9':   hours < 12 ? `Morning, ${fresh.name}!` : hours < 18 ? `Hey ${fresh.name}!` : `Evening, ${fresh.name}!`,
        '10-15': hours < 12 ? `Morning.` : hours < 18 ? `Hey.` : `Evening.`,
        '15+':   hours < 12 ? `Good morning` : hours < 18 ? `Good afternoon` : `Good evening`,
      },
      cs: {
        '4-6':   hours < 12 ? `Dobré ráno, ${fresh.name}! 🌞` : hours < 18 ? `Ahoj ${fresh.name}! 👋` : `Dobrý večer, ${fresh.name}! 🌙`,
        '7-9':   hours < 12 ? `Ráno, ${fresh.name}!` : hours < 18 ? `Ahoj ${fresh.name}!` : `Večer, ${fresh.name}!`,
        '10-15': hours < 12 ? `Ráno.` : hours < 18 ? `Čau.` : `Večer.`,
        '15+':   hours < 12 ? `Dobré ráno` : hours < 18 ? `Dobré odpoledne` : `Dobrý večer`,
      }
    };
    const lang2 = getLang();
    const greetMap = greetings[lang2] || greetings.en;
    const greetEl = document.getElementById('mapGreeting');
    if (greetEl) greetEl.textContent = greetMap[fresh.age] || greetMap['7-9'];

    // TTS greeting for 4-6
    if (fresh.age === '4-6') {
      const greetText = greetMap['4-6'];
      setTimeout(() => Speech.speak(greetText), 400);
    }
    const title = Profiles.getTitle(fresh);
    const titleEl = document.getElementById('mapTitle');
    if (titleEl) titleEl.textContent = title;

    this._setText('bb-label', t.bb_label);

    // World tiles
    WORLDS.forEach(w => {
      this._setText('wn-' + w, t.worlds[w]);
      const done  = (fresh.completedToday || []).includes(w);
      const tasks = fresh.worldTasks?.[w] || 0;
      const tile  = document.getElementById('tile-' + w);
      if (!tile) return;
      tile.classList.toggle('done', done);

      // Progress dots
      const prog = Profiles.getBadgeProgress(fresh.id, w);
      const dotsEl = document.getElementById('dots-' + w);
      if (dotsEl) {
        dotsEl.innerHTML = '';
        for (let i = 0; i < 3; i++) {
          const d = document.createElement('div');
          d.className = 'tdot' + (i < prog ? ' filled' : '');
          dotsEl.appendChild(d);
        }
      }

      // Badge level indicator on tile
      const badge = Badges.getBadge(w, tasks);
      this._setText('wp-' + w, done ? t.map_done : `${badge.e} ${t.map_new}`);

      // Done check
      let ov = tile.querySelector('.done-check');
      if (done && !ov)   { const d = document.createElement('div'); d.className='done-check'; d.textContent='✅'; tile.appendChild(d); }
      if (!done && ov)   { ov.remove(); }
    });

    // Badge preview
    const icons = document.getElementById('bbIcons');
    if (icons) {
      icons.innerHTML = '';
      const worldsWithProgress = WORLDS.filter(w => (fresh.worldTasks?.[w] || 0) > 0);
      if (worldsWithProgress.length) {
        worldsWithProgress.slice(0, 3).forEach(w => {
          const badge = Badges.getBadge(w, fresh.worldTasks[w]);
          const el = document.createElement('div');
          el.className = 'bmini'; el.textContent = badge.e;
          icons.appendChild(el);
        });
      } else {
        const el = document.createElement('div');
        el.className = 'bmini'; el.textContent = '?';
        icons.appendChild(el);
      }
    }
    // Stats row for older ages (CSS shows/hides via .map-stats)
    const stats = Profiles.getStats(fresh.id);
    this._setText('mapTotalTasks', stats.totalTasks);
    this._setText('mapBestStreak', `${stats.currentStreak} 🔥`);
    const lang3 = getLang();
    this._setText('mapTotalLbl',  lang3 === 'cs' ? 'celkem úkolů' : 'total tasks');
    this._setText('mapStreakLbl', lang3 === 'cs' ? 'aktuální série' : 'current streak');
  },
  async openWorld(world) { await Challenge.open(world); },

  // ─── BADGES SCREEN ───
  async renderBadges() {
    const p = Profiles.active();
    if (!p) return;
    const t = tr();
    this._setText('bc-title', t.my_badges);
    this._setText('streak-title', t.streak_title);

    // Streak badges
    const row = document.getElementById('streakRow');
    if (row) {
      row.innerHTML = '';
      (t.streakBadges || []).forEach(sb => {
        const earned = (p.streak || 0) >= sb.days;
        const el = document.createElement('div');
        el.className = 'sbi' + (earned ? ' earned' : '');
        el.innerHTML = `<div class="sbi-ring">${earned ? sb.e : '🔒'}</div><div class="sbi-lbl">${sb.desc}</div>`;
        row.appendChild(el);
      });
    }

    // World badges — evolving
    const grid = document.getElementById('worldBadgeGrid');
    if (grid) {
      grid.innerHTML = '';
      WORLDS.forEach(w => {
        const tasks = p.worldTasks?.[w] || 0;
        const badge = Badges.getBadge(w, tasks);
        const next  = Badges.nextThreshold(tasks);
        const cell  = document.createElement('div');
        cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;';
        const badgeEl = Badges.renderWorldBadge(w, tasks, 72);
        const worldLbl = document.createElement('div');
        worldLbl.style.cssText = 'font-size:10px;font-weight:800;color:var(--green-mid);text-align:center';
        worldLbl.textContent = t.worlds[w];
        const countLbl = document.createElement('div');
        countLbl.style.cssText = 'font-size:9px;font-weight:700;color:var(--green-mid);text-align:center';
        countLbl.textContent = next ? `${tasks}/${next}` : `${tasks} ★`;
        cell.appendChild(badgeEl);
        cell.appendChild(worldLbl);
        cell.appendChild(countLbl);
        grid.appendChild(cell);
      });
    }
  },

  // ─── SETTINGS ───
  async renderSettings() {
    const t = tr(), p = Profiles.active();
    this._setText('set-title',      t.set_title);
    this._setText('ss-lang-title',  t.ss_lang);
    this._setText('ss-lang-lbl',    t.ss_lang_lbl);
    this._setText('ss-data-title',  t.ss_data);
    this._setText('ss-reset-btn',   t.ss_reset);
    this._setText('ss-family-title',   t.ss_family);
    this._setText('ss-family-code-lbl',t.ss_family_code);
    this._setText('ss-family-join',    t.ss_family_join);
    this._setText('ss-join-btn',       t.ss_join_btn);
    this._setAttr('joinCodeInput', 'placeholder', t.ss_join_placeholder || 'XXXXXX');

    const l = getLang();
    document.getElementById('ssEN')?.classList.toggle('active', l === 'en');
    document.getElementById('ssCZ')?.classList.toggle('active', l === 'cs');

    // Profile section
    const psec = document.getElementById('ss-profile-sec');
    if (psec) psec.style.display = p ? 'block' : 'none';
    if (p) {
      this._setText('ss-profile-title', t.ss_profile);
      this._setText('ss-age-label',     t.ss_age);
      this._setText('ss-name-label',    t.ss_name);
      // age buttons
      const row = document.getElementById('ssAgeRow');
      if (row) {
        row.innerHTML = '';
        ['4-6','7-9','10-15','15+'].forEach(a => {
          const btn = document.createElement('button');
          btn.className = 'abtn' + (p.age === a ? ' active' : '');
          btn.textContent = a;
          btn.onclick = () => {
            Profiles.update(p.id, { age: a });
            this.applyTheme(a);
            this.renderSettings();
          };
          row.appendChild(btn);
        });
      }
      // Theme preview label
      const themeLabels = {
        en: { '4-6':'Jumbo UI, auto voice, big buttons', '7-9':'Playful, colorful, full map', '10-15':'Clean dark UI, fast, no baby stuff', '15+':'Minimal, calm, journal-like' },
        cs: { '4-6':'Velké UI, automatický hlas, mega tlačítka', '7-9':'Hravé, barevné, celá mapa', '10-15':'Čisté tmavé UI, rychlé, bez dětských prvků', '15+':'Minimální, klidné, deníkový styl' }
      };
      const lang2 = getLang();
      const themeDesc = themeLabels[lang2]?.[p.age] || '';
      this._setText('ssThemePreview', themeDesc);
      const prev = document.getElementById('ssAvatarPreview');
      if (prev) {
        if (p.hasPhoto) {
          const photo = Profiles.getPhoto(p.id);
          prev.innerHTML = photo ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : p.avatar || '🧒';
        } else { prev.textContent = p.avatar || '🧒'; }
      }
      if (nameInput) { nameInput.value = p.name; nameInput.oninput = () => Profiles.update(p.id, { name: nameInput.value.trim() || p.name }); }
      // Family code
      const code = Profiles.getFamilyCode();
      this._setText('ssFamilyCodeNum', code || '——');
    }
  },

  generateFamilyCode() {
    const code = Profiles.generateFamilyCode();
    this._setText('ssFamilyCodeNum', code);
  },

  joinFamily() {
    const input = document.getElementById('joinCodeInput');
    const code  = input?.value.trim().toUpperCase();
    if (!code || code.length < 4) return;
    const p = Profiles.active();
    if (p) {
      Profiles.update(p.id, { familyCode: code });
      this._setText('ssFamilyCodeNum', code);
      input.value = '';
      // Visual feedback
      const btn = document.getElementById('ss-join-btn');
      if (btn) { btn.textContent = '✓'; setTimeout(() => { btn.textContent = '→'; }, 1500); }
    }
  },

  setLangSetting(l) {
    setLang(l);
    const p = Profiles.active();
    if (p) Profiles.update(p.id, { lang: l });
    this.renderSettings();
    this._syncLangBtns();
  },

  // ─── Profile edit (photo) ───
  async openPhotoUpload() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const p = Profiles.active();
        if (!p) return;
        Profiles.savePhoto(p.id, ev.target.result);
        // Update preview
        const prev = document.getElementById('ssAvatarPreview');
        if (prev) prev.innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  },

  removePhoto() {
    const p = Profiles.active();
    if (!p) return;
    Profiles.removePhoto(p.id);
    const prev = document.getElementById('ssAvatarPreview');
    if (prev) prev.textContent = p.avatar || '🧒';
  },

  // ─── Stats ───
  async renderStats() {
    const container = document.getElementById('screen-stats');
    if (container) Stats.render(container);
  },

  // ─── Challenge actions ───
  handlePhoto()  { Challenge.handlePhoto(); },
  handleDraw()   { Challenge.handleDraw(); },
  handleVoice()  { Challenge.handleVoice(); },
  handleWrite()  { Challenge.handleWrite(); },
  nextStep()     { Challenge.nextStep(); },
  parentConfirm(){ Challenge.parentConfirm(); },
  parentDeny()   { Challenge.parentDeny(); },

  // ─── Draw actions ───
  drawSetColor(btn)  { Draw.setColor(btn.dataset.color); document.querySelectorAll('.cbtn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); },
  drawSetSize(btn)   { Draw.setSize(parseInt(btn.dataset.size)); document.querySelectorAll('.sz-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); },
  drawClear()        { Draw.clear(); },
  drawDone()         { Draw.done(); },

  // ─── Write actions ───
  writeValidate(el) {
    const lang  = getLang();
    const words = el?.value.trim() ? el.value.trim().split(/\s+/).length : 0;
    const wrd   = lang === 'cs' ? 'slov' : 'words';
    this._setText('writeCount', `${words} ${wrd}`);
    const btn = document.getElementById('btn-done-write');
    if (btn) {
      const ok = words > 0;
      btn.disabled      = !ok;
      btn.style.opacity = ok ? '1' : '0.4';
      btn.style.cursor  = ok ? 'pointer' : 'not-allowed';
    }
  },
  writeDone() { TextInput.done(); },

  // ─── Camera actions ───
  cameraClose()     { Camera.close(); },
  cameraTakePhoto() { Camera.takePhoto(); },

  // ─── Speech ───
  speakChallenge()  { Speech.readCurrent(); },

  // ─── Draw screen init ───
  _initDraw() {
    Draw.init();
    const lang = getLang();
    this._setText('draw-label', lang === 'cs' ? 'Nakresli svůj důkaz 🎨' : 'Draw your proof 🎨');
    this._setText('btn-done-lbl', lang === 'cs' ? '✅ Hotovo!' : '✅ Done!');
  },

  // ─── Write screen init ───
  _initWrite() {
    const lang = getLang();
    this._setText('write-label', lang === 'cs' ? 'Napiš svou odpověď ✍️' : 'Write your answer ✍️');
    this._setText('btn-done-write', lang === 'cs' ? '✅ Hotovo!' : '✅ Done!');
  },

  // ─── Write validate ───
  writeValidate(el) {
    const lang  = getLang();
    const words = el.value.trim() ? el.value.trim().split(/\s+/).length : 0;
    const wrd   = lang === 'cs' ? 'slov' : 'words';
    this._setText('writeCount', `${words} ${wrd}`);
    const btn = document.getElementById('btn-done-write');
    if (btn) {
      const ok = el.value.trim().length > 0;
      btn.disabled       = !ok;
      btn.style.opacity  = ok ? '1' : '0.4';
      btn.style.cursor   = ok ? 'pointer' : 'not-allowed';
    }
  },

  // ─── Write done ───
  writeDone() { TextInput.done(); },

  // ─── Voice record screen ───
  _vrState: { recording: false, startTime: null, interval: null, duration: 0 },

  _initVoiceRecord() {
    const lang = getLang();
    const L = lang === 'cs'
      ? { title:'Řekni to nahlas 🎙️', tap:'Klepni pro nahrávání', done:'✅ Hotovo!', hint:'Klepni na mikrofon a začni mluvit. Klepni znovu pro zastavení.' }
      : { title:'Say it out loud 🎙️',  tap:'Tap to start',         done:'✅ Done!',    hint:'Tap the mic and start talking. Tap again to stop.' };
    this._setText('vr-title',   L.title);
    this._setText('vrStatus',   L.tap);
    this._setText('vrHint',     L.hint);
    this._setText('vrDoneBtn',  L.done);
    this._vrState = { recording: false, startTime: null, interval: null, duration: 0 };
  },

  vrToggle() {
    if (this._vrState.recording) { this._vrStop(); }
    else                         { this._vrStart(); }
  },

  _vrStart() {
    this._vrState.recording  = true;
    this._vrState.startTime  = Date.now();
    const lang = getLang();
    this._setText('vrStatus', lang === 'cs' ? 'Nahrávám...' : 'Recording...');
    const wave = document.getElementById('vrWave');
    const mic  = document.getElementById('vrMicBtn');
    const done = document.getElementById('vrDoneBtn');
    if (wave) wave.style.opacity = '1';
    if (mic)  { mic.style.transform = 'scale(1.08)'; mic.style.boxShadow = '0 8px 36px rgba(212,83,126,0.6)'; }
    if (done) done.style.display = 'none';
    this._vrState.interval = setInterval(() => {
      const s = ((Date.now() - this._vrState.startTime) / 1000).toFixed(1);
      this._setText('vrTimer', s + 's');
    }, 100);
    Speech.startRecording(
      (blob, durationMs) => { this._vrState.blob = blob; this._vrState.duration = durationMs; },
      () => { this._vrStop(); }
    );
  },

  _vrStop() {
    this._vrState.recording = false;
    clearInterval(this._vrState.interval);
    Speech.stopRecording();
    const wave = document.getElementById('vrWave');
    const mic  = document.getElementById('vrMicBtn');
    const done = document.getElementById('vrDoneBtn');
    if (wave) wave.style.opacity = '0';
    if (mic)  { mic.style.transform = 'scale(1)'; mic.style.boxShadow = '0 6px 28px rgba(212,83,126,0.4)'; }
    this._setText('vrStatus', '');
    setTimeout(() => { if (done) done.style.display = 'block'; }, 300);
    this._vrState.duration = Date.now() - (this._vrState.startTime || Date.now());
  },

  vrDone() {
    if (window._voiceOnComplete) {
      const ok = window._voiceOnComplete(this._vrState.blob, this._vrState.duration);
      if (ok === false) return;
    }
  },

  vrCancel() {
    clearInterval(this._vrState?.interval);
    Speech.stopRecording();
    Router.show('challenge');
  },

  // ─── Parent confirm screen ───
  _initParentConfirm() {
    const lang = getLang();
    const L = lang === 'cs'
      ? { title:'Rodiči, podívej se! 👀', sub:'Dítě splnilo výzvu. Zkontroluj důkaz a rozhodnutí.', yes:'✅ Splněno!', no:'↩️ Zkusit znovu', hint:'Pokud důkaz nestačí, pošli dítě splnit výzvu znovu.' }
      : { title:'Parent, take a look! 👀', sub:"Your child completed the challenge. Check the proof and decide.", yes:'✅ Completed!', no:'↩️ Try again', hint:"If the proof isn't good enough, send them back to try again." };
    this._setText('pc-title', L.title);
    this._setText('pc-sub',   L.sub);
    this._setText('pc-yes',   L.yes);
    this._setText('pc-no',    L.no);
    this._setText('pc-hint',  L.hint);
  },

  // ─── Reset ───
  resetAll() {
    const msg = getLang()==='cs' ? 'Smazat VŠECHNA data?' : 'Reset ALL data?';
    if (confirm(msg)) Profiles.resetAll();
  },

  // ─── Helpers ───
  _setText(id, val)       { const el = document.getElementById(id); if (el) el.textContent = val; },
  _setAttr(id, attr, val) { const el = document.getElementById(id); if (el) el[attr] = val; }
};

// ─── Screen lifecycle events ───
document.addEventListener('screen:ready', ({ detail: { screenId } }) => {
  switch (screenId) {
    case 'onboarding':  App.renderOnboarding(); break;
    case 'profiles':    App.renderProfiles();   break;
    case 'map':         App.renderMap();         break;
    case 'badges':      App.renderBadges();      break;
    case 'settings':      App.renderSettings();      break;
    case 'stats':         App.renderStats();         break;
    case 'draw':          App._initDraw();           break;
    case 'write':         App._initWrite();          break;
    case 'voice-record':  App._initVoiceRecord();   break;
    case 'parent-confirm':App._initParentConfirm(); break;
  }
});

// ─── Start ───
App.init();
