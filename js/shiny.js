// ═══════════════════════════════════
//  GREAM — shiny.js  (zářivý greamík, šance 1 : 100)
//  Zářivý = jiná barevná varianta (jako u Pokémonů) + stříbrné jiskření (CSS .shiny / greamShinyGlow).
//  Doplněk Hvězdná záře = zlatá svatozář → obojí jde na první pohled rozlišit.
// ═══════════════════════════════════

// Posun odstínu podle druhu (vybráno tak, aby varianta působila záměrně, ne jako chyba)
export const SHINY_HUE = { lilek: -80, jiskra: 150, kamen: 170, srodik: -75, vlnka: 175, atlas: 125,
  tlapka: 160, kanka: -120, poctik: 140, hrejik: 150, noticka: -140, mapka: 110 };

const cache = new Map();

function rotate(r, g, b, deg) {
  // RGB → HSL → posun H → RGB
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return null;                       // šedá/černá/bílá (obrysy, odlesky) beze změny
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = ((h * 60 + deg) % 360 + 360) % 360 / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}

// Vrátí přebarvenou kopii obrázku (canvas) – kreslí se místo původního listu. Bez prohlížeče/chyby → původní obrázek.
export function shinySource(img, arch) {
  if (!img || typeof document === 'undefined' || !SHINY_HUE[arch]) return img;
  const key = (img.src || img.currentSrc || '') + '|' + arch;
  if (cache.has(key)) return cache.get(key);
  try {
    const c = document.createElement('canvas'); c.width = img.naturalWidth || img.width; c.height = img.naturalHeight || img.height;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const im = ctx.getImageData(0, 0, c.width, c.height), d = im.data, deg = SHINY_HUE[arch];
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 16) continue;
      const o = rotate(d[i], d[i + 1], d[i + 2], deg);
      if (o) { d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; }
    }
    ctx.putImageData(im, 0, 0);
    c.src = img.src;                                   // aby šlo podle src poznat stádium (_drawSpriteCell)
    cache.set(key, c);
    return c;
  } catch { return img; }
}
