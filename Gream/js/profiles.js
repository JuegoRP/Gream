// ═══════════════════════════════════
//  GREAM — profiles.js
//  Profile CRUD, photo, family codes
// ═══════════════════════════════════

import { tr } from './i18n.js';
import { Badges } from './badges.js';

const KEY_PROFILES = 'gream_profiles';
const KEY_ACTIVE   = 'gream_active';
const KEY_FAMILY   = 'gream_family';

// ─── Storage helpers ───
const load = (k, d) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

export const Profiles = {

  // ─── Get all profiles ───
  all() { return load(KEY_PROFILES, []); },

  // ─── Get active profile ───
  active() {
    const id = load(KEY_ACTIVE, null);
    return this.all().find(p => p.id === id) || null;
  },

  // ─── Set active profile ───
  setActive(id) { save(KEY_ACTIVE, id); },

  // ─── Create new profile ───
  create({ name, avatar, age, lang }) {
    const profiles = this.all();
    const id = 'p' + Date.now();
    const profile = {
      id, name, avatar, age, lang,
      streak: 0,
      bestStreak: 0,
      lastDate: '',
      totalTasks: 0,
      worldTasks: { nature:0, language:0, logic:0, feelings:0, arts:0, world:0 },
      badgeProgress: {},   // { worldId: { steps: [0,1,2] } }
      earnedStreakBadges: [],
      completedToday: [],
      familyCode: null,
      createdAt: new Date().toISOString()
    };
    profiles.push(profile);
    save(KEY_PROFILES, profiles);
    this.setActive(id);
    return profile;
  },

  // ─── Update profile field ───
  update(id, fields) {
    const profiles = this.all();
    const i = profiles.findIndex(p => p.id === id);
    if (i === -1) return null;
    Object.assign(profiles[i], fields);
    save(KEY_PROFILES, profiles);
    return profiles[i];
  },

  // ─── Delete profile ───
  delete(id) {
    const profiles = this.all().filter(p => p.id !== id);
    save(KEY_PROFILES, profiles);
    if (load(KEY_ACTIVE, null) === id) {
      save(KEY_ACTIVE, profiles[0]?.id || null);
    }
  },

  // ─── Save photo (base64) ───
  savePhoto(id, dataUrl) {
    // Store photo separately to avoid bloating profiles array
    localStorage.setItem(`gream_photo_${id}`, dataUrl);
    this.update(id, { hasPhoto: true });
  },

  // ─── Get photo ───
  getPhoto(id) {
    return localStorage.getItem(`gream_photo_${id}`) || null;
  },

  // ─── Remove photo ───
  removePhoto(id) {
    localStorage.removeItem(`gream_photo_${id}`);
    this.update(id, { hasPhoto: false, avatar: '🧒' });
  },

  // ─── Render avatar element ───
  renderAvatar(profile, size = 'md') {
    const el = document.createElement('div');
    const cls = size === 'sm' ? 'map-av' : 'p-avatar';
    el.className = cls;
    if (profile.hasPhoto) {
      const photo = this.getPhoto(profile.id);
      if (photo) { el.innerHTML = `<img src="${photo}" alt="${profile.name}">`; return el; }
    }
    el.textContent = profile.avatar || '🧒';
    return el;
  },

  // ─── Check & update streak ───
  checkStreak(id) {
    const profiles = this.all();
    const p = profiles.find(x => x.id === id);
    if (!p) return;
    const today = new Date().toDateString();
    if (p.lastDate === today) return;
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    p.streak = (p.lastDate === yesterday) ? (p.streak || 0) + 1 : 1;
    if (p.streak > (p.bestStreak || 0)) p.bestStreak = p.streak;
    p.lastDate = today;
    p.completedToday = [];
    save(KEY_PROFILES, profiles);
  },

  // ─── Record completed task ───
  completeTask(id, world, stepIndex) {
    const profiles = this.all();
    const p = profiles.find(x => x.id === id);
    if (!p) return null;

    // Badge progress
    if (!p.badgeProgress) p.badgeProgress = {};
    if (!p.badgeProgress[world]) p.badgeProgress[world] = { steps: [] };
    const prog = p.badgeProgress[world];
    if (!prog.steps.includes(stepIndex)) prog.steps.push(stepIndex);

    // Completed today
    if (!p.completedToday) p.completedToday = [];
    if (!p.completedToday.includes(world)) p.completedToday.push(world);

    // Task counts
    p.totalTasks = (p.totalTasks || 0) + 1;
    if (!p.worldTasks) p.worldTasks = {};
    p.worldTasks[world] = (p.worldTasks[world] || 0) + 1;

    save(KEY_PROFILES, profiles);

    // Check if badge complete (3 steps)
    const stepsComplete = prog.steps.length >= 3;
    if (stepsComplete) {
      p.badgeProgress[world] = { steps: [] }; // reset for next badge
      save(KEY_PROFILES, profiles);
    }
    return { stepsComplete, stepsDone: prog.steps.length };
  },

  // ─── Get badge progress for world ───
  getBadgeProgress(id, world) {
    const p = this.all().find(x => x.id === id);
    return p?.badgeProgress?.[world]?.steps?.length || 0;
  },

  // ─── Profile title based on total tasks ───
  getTitle(profile) {
    const titles = tr().profileTitles || [];
    const total = profile.totalTasks || 0;
    let title = '';
    for (const t of titles) { if (total >= t.min) title = t.title; }
    return title;
  },

  // ─── Family code ───
  generateFamilyCode() {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const p = this.active();
    if (p) this.update(p.id, { familyCode: code });
    return code;
  },

  getFamilyCode() {
    return this.active()?.familyCode || null;
  },

  // ─── Stats for active profile ───
  getStats(id) {
    const p = this.all().find(x => x.id === id);
    if (!p) return {};
    const tr2 = tr();
    const worlds = Object.keys(p.worldTasks || {});
    const worldsExplored = worlds.filter(w => (p.worldTasks[w] || 0) > 0).length;
    // count earned badges
    let earnedBadges = 0;
    for (const w of ['nature','language','logic','feelings','arts','world']) {
      earnedBadges += Badges.getLevelIndex(p.worldTasks?.[w] || 0);
    }
    return {
      totalTasks:    p.totalTasks || 0,
      bestStreak:    p.bestStreak || 0,
      currentStreak: p.streak || 0,
      worldsExplored,
      earnedBadges
    };
  },

  // ─── Leaderboard (local — all profiles on device) ───
  getLeaderboard() {
    return this.all()
      .map(p => ({ id:p.id, name:p.name, avatar:p.avatar, hasPhoto:p.hasPhoto, score:p.totalTasks||0, streak:p.streak||0 }))
      .sort((a,b) => b.score - a.score);
  },

  // ─── Reset all data ───
  resetAll() {
    localStorage.clear();
    location.reload();
  }
};
