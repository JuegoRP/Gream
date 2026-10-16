// ═══════════════════════════════════
//  GREAM — ranking.js
//  Lokální ranking (offline-first)
//  Připraveno na server sync (future)
// ═══════════════════════════════════

import { Badges } from './badges.js';

const KEY_RANK = 'gream_rank_v1';

export const Ranking = {

  // ─── Aktualizuj lokální skóre (po splněném úkolu / otevření žebříčku) ───
  update(profileId, profile, _badges, gream) {
    const data = this._load();
    const s = this.summary(profile, gream);
    data[profileId] = {
      name:      profile?.name || 'Player',
      avatar:    profile?.avatar || '🧒',
      ...s,
      updatedAt: Date.now(),
    };
    this._save(data);
  },

  // ─── Jediný výpočet bodů pro celou hru (žebříček Sbírka, statistiky, profil) ───
  // 1.1: body = výzvy × 10 + greamíci ve sbírce (různé druhy z 24) × 200 + odznaky × 100
  //      (druhý parametr: pole greamíků profilu; starší volání s jedním greamíkem dál funguje)
  summary(profile, greams) {
    const list = Array.isArray(greams) ? greams : (greams ? [greams] : []);
    const tasks  = profile?.totalTasks || 0;
    const streak = profile?.streak || 0;
    const badges = Badges.earnedCount(profile);
    const kinds  = new Set(list.filter(g => g && g.stage >= 2 && g.archetype).map(g => g.archetype)).size;
    const greamStage = Math.max(1, ...list.map(g => g?.stage || 1));
    const worlds = Object.values(profile?.worldTasks || {}).filter(n => n > 0).length;
    return { tasks, streak, badges, greams: kinds, greamStage, worlds, score: this._calcScore(tasks, kinds, badges) };
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
  _calcScore(tasks, greams, badges) {
    return tasks * 10 + greams * 200 + badges * 100;
  },

  // ─── Rank title podle skóre ───
  rankTitle(score, lang = 'cs') {
    const titles = [
      { min: 0,     cs: 'Semínko',       en: 'Seed'        },
      { min: 100,   cs: 'Výhonek',       en: 'Sprout'      },
      { min: 500,   cs: 'Průzkumník',    en: 'Explorer'    },
      { min: 1500,  cs: 'Dobrodruh',     en: 'Adventurer'  },
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
