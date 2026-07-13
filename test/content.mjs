// Gream — content validator. Kontroluje, že KAŽDÁ výzva má ověřitelnou správnou
// odpověď dle svého typu (proti Validatoru v js/validator.js). Spustit: node test/content.mjs
const base = new URL('../js/', import.meta.url);
const { T } = await import(new URL('i18n.js', base));

let issues = [];
const norm = s => String(s).toLowerCase().trim();

for (const lang of ['en', 'cs']) {
  const C = T[lang].challenges;
  for (const w of Object.keys(C)) for (const d of Object.keys(C[w])) {
    C[w][d].forEach((ch, i) => {
      const at = `${lang}|${w}|${d}[${i}]`;
      const t = ch.check?.type;
      const short = (ch.text || '').slice(0, 45);
      if (!t) { issues.push(`${at} NO check.type — "${short}"`); return; }

      if (t === 'choice') {
        if (!Array.isArray(ch.choices) || ch.choices.length < 2) { issues.push(`${at} choice <2 options — "${short}"`); return; }
        if (ch.check.correct == null) { issues.push(`${at} choice no correct — "${short}"`); return; }
        const correct = Array.isArray(ch.check.correct) ? ch.check.correct : [ch.check.correct];
        const matches = ch.choices.filter(c => correct.some(cc => norm(c.value ?? c.text) === norm(cc)));
        if (matches.length !== 1) issues.push(`${at} choice matches=${matches.length} (need 1) correct=${ch.check.correct} — "${short}"`);
      }
      else if (t === 'number') {
        // answer null = intentional open/observation; if defined must be finite number
        if (ch.check.answer != null && !Number.isFinite(Number(ch.check.answer))) issues.push(`${at} number bad answer=${ch.check.answer} — "${short}"`);
      }
      else if (t === 'fill_blank') {
        if (!ch.check.correct || !String(ch.check.correct).trim()) issues.push(`${at} fill_blank empty correct — "${short}"`);
        if (!ch.blank || ch.blank.before == null) issues.push(`${at} fill_blank no blank.before — "${short}"`);
        if (ch.blank && ch.blank.correct != null && norm(ch.blank.correct) !== norm(ch.check.correct)) issues.push(`${at} fill_blank blank.correct≠check.correct — "${short}"`);
      }
      else if (t === 'sort') {
        if (!Array.isArray(ch.items) || !Array.isArray(ch.check.correct)) { issues.push(`${at} sort missing items/correct — "${short}"`); return; }
        if (ch.items.length !== ch.check.correct.length) { issues.push(`${at} sort len items=${ch.items.length}≠correct=${ch.check.correct.length} — "${short}"`); return; }
        const a = [...ch.items].sort(), b = [...ch.check.correct].sort();
        if (JSON.stringify(a) !== JSON.stringify(b)) issues.push(`${at} sort correct is NOT a permutation of items — "${short}"`);
      }
      else if (t === 'match') {
        if (!Array.isArray(ch.pairs) || ch.pairs.length < 2) { issues.push(`${at} match <2 pairs — "${short}"`); return; }
        const bs = ch.pairs.map(p => norm(p.b)), as = ch.pairs.map(p => norm(p.a));
        if (new Set(bs).size !== bs.length) issues.push(`${at} match duplicate b (ambiguous) — "${short}"`);
        if (new Set(as).size !== as.length) issues.push(`${at} match duplicate a — "${short}"`);
        if (ch.pairs.some(p => p.a == null || p.b == null)) issues.push(`${at} match null pair — "${short}"`);
      }
      else issues.push(`${at} unknown type '${t}' — "${short}"`);
    });
  }
}

// ── Ověření, že VALIDATOR reálně přijme správnou a odmítne špatnou odpověď ──
const { Validator } = await import(new URL('validator.js', base));
let behav = [];
for (const lang of ['en', 'cs']) {
  const C = T[lang].challenges;
  for (const w of Object.keys(C)) for (const d of Object.keys(C[w])) {
    C[w][d].forEach((ch, i) => {
      const at = `${lang}|${w}|${d}[${i}]`;
      const t = ch.check?.type;
      if (t === 'choice') {
        const correct = Array.isArray(ch.check.correct) ? ch.check.correct : [ch.check.correct];
        const right = ch.choices.find(c => correct.some(cc => norm(c.value ?? c.text) === norm(cc)));
        const wrong = ch.choices.find(c => !correct.some(cc => norm(c.value ?? c.text) === norm(cc)));
        if (right && !Validator.validate(ch.check, right.value ?? right.text, 'choice', lang).passed) behav.push(`${at} choice REJECTS correct answer`);
        if (wrong && Validator.validate(ch.check, wrong.value ?? wrong.text, 'choice', lang).passed) behav.push(`${at} choice ACCEPTS wrong answer`);
      }
      else if (t === 'number' && ch.check.answer != null) {
        const tol = ch.check.tolerance ?? 0;
        if (!Validator.validate(ch.check, String(ch.check.answer), 'number', lang).passed) behav.push(`${at} number REJECTS correct`);
        if (Validator.validate(ch.check, String(Number(ch.check.answer) + tol + 100), 'number', lang).passed) behav.push(`${at} number ACCEPTS far-wrong`);
      }
      else if (t === 'fill_blank') {
        if (!Validator.validate(ch.check, ch.check.correct, 'text', lang).passed) behav.push(`${at} fill_blank REJECTS correct`);
        if (Validator.validate(ch.check, 'zzz-nope-'+i, 'text', lang).passed) behav.push(`${at} fill_blank ACCEPTS wrong`);
      }
      else if (t === 'sort') {
        // score() must give 100 for correct order, less for reversed
        const right = ch.check.correct.join('→');
        const rev = [...ch.check.correct].reverse().join('→');
        if (Validator.score(ch.check, right, 'sort') !== 100) behav.push(`${at} sort correct order ≠100`);
        if (ch.check.correct.length > 1 && Validator.score(ch.check, rev, 'sort') >= 100) behav.push(`${at} sort reversed still 100`);
      }
    });
  }
}

let total = 0; for (const w of Object.keys(T.en.challenges)) for (const d of Object.keys(T.en.challenges[w])) total += T.en.challenges[w][d].length;
console.log(`Zkontrolováno ${total} výzev/jazyk (${total*2} celkem).`);
const all = issues.concat(behav);
if (all.length) { console.log(`\n✗ ${all.length} PROBLÉMŮ:`); all.slice(0, 40).forEach(x => console.log('  ', x)); }
else console.log('✓ Všechny výzvy mají správnou odpověď A validator správně přijímá/odmítá (choice/number/fill_blank/sort).');
process.exit(all.length ? 1 : 0);
