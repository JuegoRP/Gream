// ═══════════════════════════════════
//  GREAM — badges.js
//  Evolving badge system
//  7 levels per world: 0,10,20,30,40,50,100 tasks
// ═══════════════════════════════════

import { tr } from './i18n.js';

const THRESHOLDS = [0, 10, 20, 30, 40, 50, 100];

export const Badges = {

  // ─── Get level index (0–6) for task count ───
  getLevelIndex(taskCount) {
    let level = 0;
    for (let i = 0; i < THRESHOLDS.length; i++) {
      if (taskCount >= THRESHOLDS[i]) level = i;
    }
    return level;
  },

  // ─── Get badge data for a world at given task count ───
  getBadge(world, taskCount) {
    const levels = tr().badgeLevels?.[world] || [];
    const idx = this.getLevelIndex(taskCount);
    return levels[idx] || levels[0] || { e: '🏅', n: 'Badge', lvl: 0 };
  },

  // ─── Check if task count crossed a threshold (badge evolved) ───
  didEvolve(prevCount, newCount) {
    return this.getLevelIndex(prevCount) !== this.getLevelIndex(newCount);
  },

  // ─── Get next threshold ───
  nextThreshold(taskCount) {
    for (const t of THRESHOLDS) { if (t > taskCount) return t; }
    return null; // maxed out
  },

  // ─── Tasks until next level ───
  tasksUntilNext(taskCount) {
    const next = this.nextThreshold(taskCount);
    return next !== null ? next - taskCount : 0;
  },

  // ─── Render world badge element ───
  renderWorldBadge(world, taskCount, size = 60) {
    const badge = this.getBadge(world, taskCount);
    const level = this.getLevelIndex(taskCount);
    const next  = this.nextThreshold(taskCount);
    const base  = THRESHOLDS[level];
    const progress = next ? Math.max(0, Math.min(100, Math.round((taskCount - base) / (next - base) * 100))) : 100;
    const el = document.createElement('div');
    el.className = 'world-badge' + (next ? '' : ' maxed');
    el.style.setProperty('--wb-size', size + 'px');
    el.style.setProperty('--wb-progress', progress);
    el.innerHTML = `<div class="wb-disc badge-lvl-${level}"><span class="wb-emoji">${badge.e}</span></div>`;
    return el;
  },

  // ─── All world badges for a profile ───
  getAllBadges(worldTasks) {
    const worlds = ['nature','language','logic','feelings','arts','world'];
    return worlds.map(w => ({
      world: w,
      taskCount: worldTasks?.[w] || 0,
      badge: this.getBadge(w, worldTasks?.[w] || 0),
      level: this.getLevelIndex(worldTasks?.[w] || 0)
    }));
  },

  // ─── Get all earned badges for a profile (for ranking display) ───
  getEarned(profileId) {
    try {
      const data = JSON.parse(localStorage.getItem('gream_profiles') || '[]');
      const p = data.find(x => x.id === profileId);
      if (!p) return [];
      return this.getAllBadges(p.worldTasks || {}).filter(b => b.taskCount > 0);
    } catch { return []; }
  },

  // ─── Streak badge check ───
  checkStreakBadges(profile) {
    const t = tr();
    const newlyEarned = [];
    for (const sb of (t.streakBadges || [])) {
      const alreadyHas = (profile.earnedStreakBadges || []).includes(sb.days);
      if (!alreadyHas && (profile.streak || 0) >= sb.days) {
        newlyEarned.push(sb);
      }
    }
    return newlyEarned;
  }
};
