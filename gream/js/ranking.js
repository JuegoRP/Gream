// ═══════════════════════════════════
//  GREAM — ranking.js
//  Lokální ranking (offline-first)
//  Připraveno na server sync (future)
// ═══════════════════════════════════

const KEY_RANK = 'gream_rank_v1';

export const Ranking = {

  // ─── Aktualizuj lokální skóre po každém splněném úkolu ───
  update(profileId, profile, badges, gream) {
    const data = this._load();
    const tasks  = Profiles_getTotalTasks(profileId);
    const streak = profile?.streak || 0;
    const badgeCt = badges?.length || 0;
    const greamStage = gream?.stage || 1;
    const worlds = this._worldCount(profileId);

    data[profileId] = {
      name:      profile?.name || 'Player',
      avatar:    profile?.avatar || '🧒',
      tasks,
      streak,
      badges:    badgeCt,
      greamStage,
      worlds,
      score:     this._calcScore(tasks, streak, badgeCt, greamStage, worlds),
      updatedAt: Date.now(),
    };
    this._save(data);
  },

  // ─── Získej vlastní záznam ───
  own(profileId) {
    return this._load()[profileId] || null;
  },

  // ─── Lokální leaderboard (všechny profily v zařízení) ───
  local() {
    const data = this._load();
    return Object.entries(data)
      .map(([id, d]) => ({ id, ...d }))
      .sort((a, b) => b.score - a.score);
  },

  // ─── Skóre formule ───
  _calcScore(tasks, streak, badges, greamStage, worlds) {
    return (tasks * 10)
         + (streak * 50)
         + (badges * 200)
         + ((greamStage - 1) * 500)
         + (worlds * 100);
  },

  // ─── Počet světů s alespoň 1 splněným úkolem ───
  _worldCount(profileId) {
    try {
      const raw = localStorage.getItem('gream_badge_progress_' + profileId) || '{}';
      return Object.keys(JSON.parse(raw)).length;
    } catch { return 0; }
  },

  // ─── Rank title podle skóre ───
  rankTitle(score, lang = 'cs') {
    const titles = [
      { min: 0,     cs: 'Semínko',       en: 'Seed'        },
      { min: 100,   cs: 'Výhonek',       en: 'Sprout'      },
      { min: 500,   cs: 'Průzkumník',    en: 'Explorer'    },
      { min: 1500,  cs: 'Dobrodruhu',    en: 'Adventurer'  },
      { min: 3000,  cs: 'Učenec',        en: 'Scholar'     },
      { min: 6000,  cs: 'Mistr přírody', en: 'Nature Master'},
      { min: 12000, cs: 'Legenda',        en: 'Legend'      },
    ];
    const t = [...titles].reverse().find(t => score >= t.min) || titles[0];
    return t[lang] || t.cs;
  },

  _load() {
    try { return JSON.parse(localStorage.getItem(KEY_RANK) || '{}'); } catch { return {}; }
  },
  _save(d) {
    try { localStorage.setItem(KEY_RANK, JSON.stringify(d)); } catch {}
  },
};

// ─── Helper — total tasks for a profile ───
function Profiles_getTotalTasks(profileId) {
  try {
    const raw = localStorage.getItem('gream_profiles') || '[]';
    const profiles = JSON.parse(raw);
    const p = profiles.find(x => x.id === profileId);
    return p?.totalTasks || 0;
  } catch { return 0; }
}
