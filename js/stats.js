// ═══════════════════════════════════
//  GREAM — stats.js
//  Statistics + leaderboard
//  Local now, backend-ready later
// ═══════════════════════════════════

import { Profiles } from './profiles.js';
import { tr } from './i18n.js';
import { Ranking } from './ranking.js';
import { Gream } from './gream.js';
import { fillIcons } from './icons.js';

export const Stats = {

  // ─── Render stats screen ───
  render(container) {
    const p = Profiles.active();
    if (!p) return;
    const t = tr();
    const stats = Profiles.getStats(p.id);
    // Body = stejný výpočet jako v Žebříčku (Ranking.summary) pro všechny profily v zařízení
    const lb = Profiles.all()
      .map(x => ({ id: x.id, name: x.name, avatar: x.avatar, score: Ranking.summary(x, Gream.active(x.id)).score }))
      .sort((a, b) => b.score - a.score);

    container.innerHTML = `
      <header class="scr-header">
        <div class="scr-left"><button class="btn-back" onclick="App.back()" data-icon="back" aria-label="${t.nav_back}"></button></div>
        <h1 class="scr-title">${t.stats_title}</h1>
        <div class="scr-right"></div>
      </header>

      <div class="stats-grid max-w" style="margin-bottom:14px">
        <div class="stat-card">
          <div class="stat-num">${stats.totalTasks}</div>
          <div class="stat-label">${t.stats_total}</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">${stats.bestStreak} 🔥</div>
          <div class="stat-label">${t.stats_streak}</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">${stats.worldsExplored}/6</div>
          <div class="stat-label">${t.stats_worlds}</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">${stats.earnedBadges}</div>
          <div class="stat-label">${t.stats_badges}</div>
        </div>
      </div>

      <div class="card-section max-w">
        <div class="section-title">${t.lb_title}</div>
        <div id="lbList"></div>
      </div>
    `;

    // Leaderboard
    const lbList = container.querySelector('#lbList');
    if (!lb.length) {
      lbList.innerHTML = `<div style="text-align:center;padding:16px;font-size:13px;color:var(--green-mid);font-weight:600">${t.lb_empty}</div>`;
    } else {
      lb.forEach((entry, i) => {
        const rankClass = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '';
        const rankIcon  = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1;
        const isSelf    = entry.id === p.id;
        const row       = document.createElement('div');
        row.className   = 'lb-row' + (isSelf ? '' : '');
        row.style.cssText = isSelf ? 'border:2px solid var(--green-pale)' : '';
        row.innerHTML   = `
          <div class="lb-rank ${rankClass}">${rankIcon}</div>
          <div class="lb-av">${entry.avatar || '🧒'}</div>
          <div class="lb-name">${entry.name}${isSelf ? ' ★' : ''}</div>
          <div class="lb-score">${entry.score.toLocaleString()} ${t.points_unit}</div>
        `;
        lbList.appendChild(row);
      });
    }
    fillIcons(container);
  },

  // ─── FUTURE: sync to backend ───
  // async syncToBackend(profile) { ... }
  // async fetchGlobalLeaderboard() { ... }
};
