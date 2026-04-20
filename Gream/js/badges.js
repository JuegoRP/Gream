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
  renderWorldBadge(world, taskCount, size = 80) {
    const badge = this.getBadge(world, taskCount);
    const level = this.getLevelIndex(taskCount);
    const el = document.createElement('div');
    el.className = `world-badge badge-lvl-${level}`;
    el.style.width = el.style.height = size + 'px';
    const extra = taskCount >= 100 ? `<div class="wb-count">+${taskCount - 100}</div>` : '';
    const next = this.nextThreshold(taskCount);
    const progress = next ? Math.round((taskCount - THRESHOLDS[level]) / (next - THRESHOLDS[level]) * 100) : 100;
    el.innerHTML = `
      <div class="wb-glow" style="background:white"></div>
      <span class="wb-emoji">${badge.e}</span>
      <span class="wb-level">${badge.n}</span>
      ${extra}
    `;
    // Progress arc overlay
    if (next && progress > 0) {
      const arc = document.createElement('div');
      arc.style.cssText = `position:absolute;inset:0;border-radius:50%;
        background:conic-gradient(rgba(255,255,255,0.35) ${progress}%,transparent ${progress}%);
        pointer-events:none;`;
      el.appendChild(arc);
    }
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
