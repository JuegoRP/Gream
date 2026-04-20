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
        const words = proof.trim().split(/\s+/).filter(Boolean).length;
        const min   = check.minWords ?? 3;
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
