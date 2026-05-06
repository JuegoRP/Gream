// ═══════════════════════════════════
//  GREAM — validator.js  v1
//  Validates challenge answers
//  No AI needed — logic-based checks
// ═══════════════════════════════════

// ─── CHECK TYPES ───────────────────
// exists   → proof just needs to exist (photo/draw)
// number   → answer is a number within tolerance
// keywords → text must contain min N of given keywords
// min_words→ text must have at least N words
// duration → audio must be at least N milliseconds
// drawing  → canvas must be non-empty (handled in Draw.done())

export const Validator = {

  // ─── Main entry point ───
  // Returns { passed: bool, feedback: string }
  validate(check, proof, proofType, lang) {
    if (!check) return { passed: true, feedback: '' };

    const L = lang === 'cs' ? FEEDBACK_CS : FEEDBACK_EN;

    switch (check.type) {

      case 'exists':
        return proof
          ? { passed: true,  feedback: '' }
          : { passed: false, feedback: L.noProof };

      case 'fill_blank': {
        if (!proof) return { passed: false, feedback: L.needText };
        const correct = check.correct || '';
        const tol = check.tolerance ?? 0;
        const proofN = parseFloat(proof.replace(',','.'));
        const corrN  = parseFloat(correct);
        if (!isNaN(proofN) && !isNaN(corrN)) {
          return Math.abs(proofN - corrN) <= tol
            ? { passed: true, feedback: '' }
            : { passed: false, feedback: lang === 'cs' ? `Správná odpověď: ${correct}` : `Correct answer: ${correct}` };
        }
        const norm = s => s.toLowerCase().trim().normalize('NFC');
        return norm(proof) === norm(correct)
          ? { passed: true, feedback: '' }
          : { passed: false, feedback: lang === 'cs' ? `Správná odpověď: ${correct}` : `Correct answer: ${correct}` };
      }

      case 'sort':
        return { passed: true, feedback: '' }; // sort scores via score()

      case 'match':
        return { passed: true, feedback: '' }; // match always passes (all pairs done)

      case 'choice': {
        if (!check.correct) return { passed: true, feedback: '' };
        const correct = Array.isArray(check.correct) ? check.correct : [check.correct];
        const ok = correct.some(c => String(c).toLowerCase() === String(proof).toLowerCase());
        return ok
          ? { passed: true, feedback: '' }
          : { passed: false, feedback: lang === 'cs' ? 'Skoro! Ale zkus to znovu.' : 'Not quite! Try again.' };
      }

      case 'number': {
        const num = this._extractNumber(proof);
        if (num === null) return { passed: false, feedback: L.needNumber };
        if (check.answer !== null && check.answer !== undefined) {
          const tol = check.tolerance ?? 0;
          const ok  = Math.abs(num - check.answer) <= tol;
          return ok
            ? { passed: true,  feedback: '' }
            : { passed: false, feedback: L.wrongNumber(check.answer, tol) };
        }
        // No correct answer defined — just needs to be a number
        return { passed: true, feedback: '' };
      }

      case 'keywords': {
        if (!proof || typeof proof !== 'string') return { passed: false, feedback: L.needText };
        const text    = proof.toLowerCase();
        const hits    = (check.keywords || []).filter(kw => text.includes(kw.toLowerCase()));
        const minMatch= check.minMatch ?? 1;
        return hits.length >= minMatch
          ? { passed: true,  feedback: '' }
          : { passed: false, feedback: L.needKeywords(minMatch, check.keywords?.slice(0, 4)) };
      }

      case 'min_words': {
        if (!proof || typeof proof !== 'string') return { passed: false, feedback: L.needText };
        const words   = proof.trim().split(/\s+/).filter(Boolean).length;
        const min     = check.minWords ?? 3;
        const avgLen  = proof.trim().length / Math.max(words, 1);
        const looksRandom = words > 2 && avgLen > 8;

        if (looksRandom) {
          return { passed: false, feedback: lang === 'cs'
            ? 'Vypadá to jako náhodné znaky — napiš skutečnou odpověď!'
            : 'This looks like random characters — please write a real answer!' };
        }

        return words >= min
          ? { passed: true,  feedback: '' }
          : { passed: false, feedback: L.needWords(min, words) };
      }

      case 'duration': {
        const ms  = typeof proof === 'number' ? proof : 0;
        const min = check.minMs ?? 2000;
        return ms >= min
          ? { passed: true,  feedback: '' }
          : { passed: false, feedback: L.tooShort(Math.round(min / 1000)) };
      }

      case 'drawing':
        // Draw.done() already calls isEmpty() check — if we got here, it passed
        return { passed: true, feedback: '' };

      default:
        return { passed: true, feedback: '' };
    }
  },

  // ─── Quality score 0-100 (richer than passed/failed) ───
  // Used to scale rewards: 80-100 full, 50-79 partial, 20-49 small, 0-19 weak
  score(check, proof, proofType) {
    if (!check) return 100;

    switch (check.type) {
      case 'fill_blank': {
        if (!proof || !check.correct) return 80;
        const norm = s => s.toLowerCase().trim().normalize('NFC');
        return norm(proof) === norm(check.correct) ? 100 : 20;
      }

      case 'sort': {
        if (!proof || !check.correct) return 80;
        const correct = Array.isArray(check.correct) ? check.correct.join('→') : check.correct;
        return proof === correct ? 100 : 35;
      }

      case 'match':
        return 100; // all pairs must be matched to submit

      case 'choice': {
        if (!check.correct) return 80;
        const correct = Array.isArray(check.correct) ? check.correct : [check.correct];
        return correct.some(c => String(c).toLowerCase() === String(proof).toLowerCase()) ? 100 : 30;
      }

      case 'exists':
        return proof ? 100 : 0;

      case 'number': {
        const num = this._extractNumber(proof);
        if (num === null) return 0;
        if (check.answer == null) return 80;
        const tol = check.tolerance ?? 0;
        const diff = Math.abs(num - check.answer);
        if (diff <= tol) return 100;
        if (diff <= tol * 2) return 60;
        if (diff <= tol * 4) return 30;
        return 10;
      }

      case 'keywords': {
        if (!proof || typeof proof !== 'string') return 0;
        const text = proof.toLowerCase();
        const all  = check.keywords || [];
        const hits = all.filter(kw => text.includes(kw.toLowerCase()));
        const ratio = all.length ? hits.length / all.length : 1;
        // Plus bonus for richness of text
        const richness = this._textRichness(proof);
        return Math.round(ratio * 60 + richness * 40);
      }

      case 'min_words': {
        if (!proof || typeof proof !== 'string') return 0;
        const min    = check.minWords ?? 3;
        const wc     = proof.trim().split(/\s+/).filter(Boolean).length;
        const avgLen = proof.trim().length / Math.max(wc, 1);
        // Random keyboard mashing — 0 seeds
        if (wc > 2 && avgLen > 8) return 0;
        if (wc < min) return Math.round((wc / min) * 25);
        // Keywords required for seeds — no keyword = minimal score
        const kws = check.keywords || [];
        const text = proof.toLowerCase();
        if (kws.length > 0) {
          const kwHit = kws.some(kw => text.includes(kw.toLowerCase()));
          if (!kwHit) return 15; // passes validation but gets almost no seeds
        }
        const richness = this._textRichness(proof);
        const lengthBonus = Math.min(1, wc / (min * 2));
        return Math.min(100, Math.round(55 + lengthBonus * 25 + richness * 20));
      }

      case 'duration': {
        const ms  = typeof proof === 'number' ? proof : 0;
        const min = check.minMs ?? 2000;
        if (ms < min) return Math.round((ms / min) * 40);
        if (ms < min * 2) return 70;
        return 90;
      }

      case 'drawing':
        return 100; // Drawing.done() handles emptiness

      default:
        return 80;
    }
  },

  // ─── Text richness (0-1) — unique words, sentence count, verb presence ───
  _textRichness(text) {
    if (!text || typeof text !== 'string') return 0;
    const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return 0;

    // Diversity (unique / total)
    const unique = new Set(words);
    const diversity = unique.size / words.length;

    // Sentence count (rough: count . ! ?)
    const sentenceCount = (text.match(/[.!?]+/g) || []).length;
    const hasSentence = sentenceCount > 0 ? 1 : 0.5;

    // Verb presence (very rough — common Czech/English verb suffixes/forms)
    const verbHints = /\b(je|jsem|jsi|jsme|jste|jsou|byl|byla|bylo|byli|měl|mám|máš|má|máme|máte|mají|chci|chceš|chce|vidím|vidíš|jdu|jde|am|is|are|was|were|have|has|had|see|saw|go|went|like|love|feel)\b/i;
    const hasVerb = verbHints.test(text) ? 1 : 0.5;

    return diversity * 0.4 + hasSentence * 0.3 + hasVerb * 0.3;
  },

  // ─── Extract first number from string ───
  _extractNumber(text) {
    if (typeof text === 'number') return text;
    if (!text) return null;
    const match = String(text).replace(',', '.').match(/-?\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : null;
  },

  // ─── STT transcript → run keywords check ───
  validateTranscript(transcript, check, lang) {
    if (!check || check.type !== 'keywords') return { passed: true, feedback: '' };
    return this.validate(check, transcript, 'text', lang);
  }
};

// ─── FEEDBACK STRINGS ───────────────
const FEEDBACK_EN = {
  noProof:     "We need some proof! Take a photo or draw something.",
  needNumber:  "Write a number as your answer.",
  needText:    "Write your answer in words.",
  wrongNumber: (ans, tol) => tol > 0
    ? `Not quite — the answer is around ${ans} (±${tol}). Try again!`
    : `Not quite — the answer is ${ans}. Try again!`,
  needKeywords:(min, examples) => `Mention at least ${min} of these: ${(examples||[]).join(', ')}...`,
  needWords:   (min, got) => `Write at least ${min} words — you wrote ${got}. Add a bit more!`,
  tooShort:    (secs) => `Say a bit more — at least ${secs} seconds!`,
};

const FEEDBACK_CS = {
  noProof:     "Potřebujeme důkaz! Vyfotič nebo nakresli.",
  needNumber:  "Napiš číslo jako odpověď.",
  needText:    "Napiš svou odpověď slovně.",
  wrongNumber: (ans, tol) => tol > 0
    ? `Skoro! Správná odpověď je přibližně ${ans} (±${tol}). Zkus znovu!`
    : `Skoro! Správná odpověď je ${ans}. Zkus znovu!`,
  needKeywords:(min, examples) => `Zmínit alespoň ${min} z těchto: ${(examples||[]).join(', ')}...`,
  needWords:   (min, got) => `Napiš alespoň ${min} slov — napsal/a jsi ${got}. Přidej trochu víc!`,
  tooShort:    (secs) => `Řekni trochu víc — alespoň ${secs} sekund!`,
};
