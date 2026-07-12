// ═══════════════════════════════════
//  GREAM — net.js  — API klient (Fáze 2 server)
//  Server: https://3rstudio.eu/api/gream/*  (za Caddy, CORS: *).
//  Vše offline-safe: při chybě/offline vrací null, NIKDY nevyhodí — hra funguje
//  bez serveru dál (souboj spadne na bota, report se tiše zahodí).
// ═══════════════════════════════════

const BASE = 'https://3rstudio.eu/api/gream';

async function req(method, path, body, timeoutMs = 6000) {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    const res = await fetch(BASE + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl ? ctrl.signal : undefined,
    });
    if (t) clearTimeout(t);
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch { return null; }
}

// Stable-ish challenge id from its (English) text — for reports/dedup.
export function challengeId(world, difficulty, enText) {
  let h = 5381;
  const s = String(enText || '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `${world}:${difficulty}:#${h.toString(36)}`;
}

export const Net = {
  base: BASE,
  report:         (data)              => req('POST', '/report', data),
  battleOpponent: (difficulty, rating) => req('POST', '/battle/opponent', { difficulty, rating }),
  battleResult:   (data)              => req('POST', '/battle/result', data),
  leaderboard:    (difficulty)        => req('GET', '/battle/leaderboard' + (difficulty ? `?difficulty=${encodeURIComponent(difficulty)}` : '')),
  poiDone:        (poiId)             => req('POST', '/poi/done', { poiId }),
  poiCounts:      (ids)              => req('GET', '/poi/counts?ids=' + encodeURIComponent((ids || []).join(','))),
};
