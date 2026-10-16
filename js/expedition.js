// ═══════════════════════════════════
//  GREAM — expedition.js  (mapa 1.1: výprava dne, vzácné místo, prozkoumané okolí)
//  Vše jen v zařízení (localStorage) – na server nic nejde, Data safety beze změny.
// ═══════════════════════════════════

import { isBattleSpot } from './geo.js';

const KEY_EXP = 'gream_expedition';   // { [pid]: { date, ids:[], done:[], rare, rareDone, paid } }
const KEY_EXPLORED = 'gream_explored'; // [ "lat,lon" buněk 0,002° (~200 m) ]
const CELL = 0.002, MAX_CELLS = 4000;
export const EXP_COUNT = 3, EXP_RADIUS = 1500, RARE_RADIUS = 2500;
export const REWARD = { place: 5, all: 15, rare: 10 };
export const EGG_RADIUS = 1000;   // vajíčko leží na místě do 1 km (jen když je košíček prázdný)

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const today = () => new Date().toISOString().slice(0, 10);
function dist(a, b) {
  const R = 6371000, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function rng(seed) { let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export const Expedition = {
  // Vybere (nebo vrátí dnešní) výpravu: 3 místa do 1,5 km + 1 vzácné do 2,5 km. Stejné celý den v okolí.
  ensure(pid, pois, pos) {
    const all = load(KEY_EXP, {});
    let st = all[pid];
    if (st && st.date === today() && st.ids.every(id => pois.some(p => p.id === id && !isBattleSpot(p)))) return st;
    if (st && st.date === today() && st.ids.length) return st;   // místa mimo dosah (jiné okolí) – výprava platí dál
    const area = `${Math.round(pos.lat * 50) / 50},${Math.round(pos.lon * 50) / 50}`;
    const r = rng(today() + '|' + area);
    // místa souboje (≈ 1 z 10) nabízí jen souboj → do výpravy ani na vajíčko se nehodí (splňuje se výzvou)
    const near = pois.filter(p => p.id && !isBattleSpot(p) && dist(pos, p) <= EXP_RADIUS);
    const pick = [];
    const pool = [...near].sort((a, b) => a.id < b.id ? -1 : 1);
    while (pick.length < EXP_COUNT && pool.length) pick.push(pool.splice(Math.floor(r() * pool.length), 1)[0].id);
    const rarePool = pois.filter(p => p.id && !isBattleSpot(p) && !pick.includes(p.id) && dist(pos, p) <= RARE_RADIUS).sort((a, b) => a.id < b.id ? -1 : 1);
    const rare = rarePool.length ? rarePool[Math.floor(r() * rarePool.length)].id : null;
    st = { date: today(), ids: pick, done: [], rare, rareDone: false, paid: false };
    all[pid] = st; save(KEY_EXP, all);
    return st;
  },
  get(pid) { const st = load(KEY_EXP, {})[pid]; return st && st.date === today() ? st : null; },

  // Vajíčko na mapě: nová vajíčka se nachází JEN venku. Je-li košíček prázdný, leží jedno na místě do 1 km
  // (stejné celý den v okolí, jiné než místa výpravy). Splnění výzvy na tom místě → vajíčko do košíčku.
  eggSpot(pid, pois, pos, basketEmpty) {
    const all = load(KEY_EXP, {}); const st = all[pid];
    if (!st) return null;
    if (!basketEmpty) { if (st.egg) { st.egg = null; save(KEY_EXP, all); } return null; }
    if (st.egg && pois.some(p => p.id === st.egg && !isBattleSpot(p))) return st.egg;
    const area = `${Math.round(pos.lat * 50) / 50},${Math.round(pos.lon * 50) / 50}`;
    const r = rng('egg|' + today() + '|' + area + '|' + (st.eggsFound || 0));
    const pool = pois.filter(p => p.id && !isBattleSpot(p) && !st.ids.includes(p.id) && p.id !== st.rare && dist(pos, p) <= EGG_RADIUS).sort((a, b) => a.id < b.id ? -1 : 1);
    st.egg = pool.length ? pool[Math.floor(r() * pool.length)].id : null;
    all[pid] = st; save(KEY_EXP, all);
    return st.egg;
  },
  takeEgg(pid, poiId) {
    const all = load(KEY_EXP, {}); const st = all[pid];
    if (!st || !st.egg || st.egg !== poiId) return false;
    st.egg = null; st.eggsFound = (st.eggsFound || 0) + 1; all[pid] = st; save(KEY_EXP, all);
    return true;
  },

  // Splněné místo → odměny: místo výpravy +5, celá výprava +15, vzácné +10. Vrací { seeds, all, rare, place }
  complete(pid, poiId) {
    const all = load(KEY_EXP, {}); const st = all[pid];
    const out = { seeds: 0, place: false, all: false, rare: false };
    if (!st || st.date !== today()) return out;
    if (st.ids.includes(poiId) && !st.done.includes(poiId)) { st.done.push(poiId); out.place = true; out.seeds += REWARD.place; }
    if (!st.paid && st.ids.length && st.ids.every(id => st.done.includes(id))) { st.paid = true; out.all = true; out.seeds += REWARD.all; }
    if (st.rare === poiId && !st.rareDone) { st.rareDone = true; out.rare = true; out.seeds += REWARD.rare; }
    all[pid] = st; save(KEY_EXP, all);
    return out;
  },

  // ─── Prozkoumané okolí (buňky ~200 m, kde hráč s otevřenou mapou byl) ───
  record(pos) {
    if (!pos) return false;
    const key = `${(Math.floor(pos.lat / CELL) * CELL).toFixed(3)},${(Math.floor(pos.lon / CELL) * CELL).toFixed(3)}`;
    const cells = load(KEY_EXPLORED, []);
    if (cells.includes(key)) return false;
    cells.push(key); if (cells.length > MAX_CELLS) cells.splice(0, cells.length - MAX_CELLS);
    save(KEY_EXPLORED, cells); return true;
  },
  cells() { return load(KEY_EXPLORED, []); },
  geojson() {
    return { type: 'FeatureCollection', features: this.cells().map(k => {
      const [la, lo] = k.split(',').map(Number);
      return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[lo, la], [lo + CELL, la], [lo + CELL, la + CELL], [lo, la + CELL], [lo, la]]] } };
    }) };
  },
};
