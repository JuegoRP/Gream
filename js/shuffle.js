// Férové zamíchání (Fisher–Yates). Pozor: arr.sort(() => Math.random() - 0.5) míchá zaujatě –
// u 3 možností nechala správnou (v datech první) odpověď na 1. místě ve 44 % případů místo 33 %.
export function shuffle(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Ozdobná emoji pryč z textu odpovědi (emoji jen u jedné možnosti prozradí správnou); odpověď jen z emoji zůstane
export function stripEmoji(x) {
  const s = String(x ?? '').replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}️‍]/gu, '').replace(/\s{2,}/g, ' ').trim();
  return s || String(x ?? '');
}

// Pořadí otázek pro konkrétního hráče: i-tá výzva ve světě → index otázky. Permutace i ↦ (start + i·krok) mod n
// (krok nesoudělný s n) ze hashe ID profilu: každý hráč jiné pořadí, bez opakování, dokud neprojde celou sadu.
export function playerOrder(pid, salt, n, i) {
  if (n <= 1) return 0;
  let h = 2166136261; for (const c of String(pid) + '|' + salt) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  h >>>= 0;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  let step = 1 + (h % (n - 1)); while (gcd(step, n) !== 1) step = step % (n - 1) + 1;
  return ((h >>> 7) % n + (i % n) * step) % n;
}
