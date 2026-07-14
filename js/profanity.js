// ═══════════════════════════════════
//  GREAM — profanity.js  — jednoduchý filtr hanlivých výrazů pro jména
//  Dětská hra → blokujeme sprostá/nenávistná slova v přezdívkách. Není to
//  dokonalé (nemá být), ale zachytí ty zjevné. Match na normalizovaném textu
//  (malá písmena, bez diakritiky, lehký leetspeak).
// ═══════════════════════════════════

// Curated list (CS + EN). Substringový match na krátkých jménech.
const BAD = [
  // CZ
  'kokot','kunda','piča','pica','pice','picu','curak','čurák','curaka','mrdk','mrdat','mrdas','prcat',
  'hovno','sracka','sračka','srac','debil','idiot','kkt','vypatlan','zmrd','buzna','buzik','teplous',
  'nacist','nacista','hajzl','kurva','kurvy','zkurv','vole','píčo','pico','čůr','cur','prdel','hnus',
  // EN
  'fuck','fuk','fck','shit','sh1t','bitch','b1tch','cunt','dick','d1ck','pussy','asshole','ass hole',
  'bastard','whore','slut','nigger','nigga','faggot','fag','retard','rape','nazi','hitler','porn','sex',
  'penis','vagina','boob','tits','wank','jerk off','cum',
];

// odstraní diakritiku, malá písmena, jednoduchý leetspeak, mezery/tečky
function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // diakritika
    .replace(/[0]/g, 'o').replace(/[1|!]/g, 'i').replace(/[3]/g, 'e').replace(/[4@]/g, 'a').replace(/[5$]/g, 's').replace(/[7]/g, 't')
    .replace(/[^a-z ]/g, '');
}

export function hasProfanity(text) {
  const t = normalize(text);
  const squashed = t.replace(/\s+/g, '');           // "f u c k" → "fuck"
  return BAD.some(w => {
    const wn = normalize(w).replace(/\s+/g, '');
    return t.includes(normalize(w)) || squashed.includes(wn);
  });
}

// Vrátí ořezané validní jméno nebo null, když je vulgární / prázdné.
export function validateName(text) {
  const trimmed = String(text || '').trim().slice(0, 20);
  if (!trimmed) return null;
  if (hasProfanity(trimmed)) return null;
  return trimmed;
}
