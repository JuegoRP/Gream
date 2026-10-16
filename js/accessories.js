// ═══════════════════════════════════
//  GREAM — accessories.js  (doplňky na greamíkovi: zahrada, aréna, výběr do souboje)
//  Kreslí se do stejného canvasu jako greamík, podle obdélníku, kam byl greamík vykreslen.
// ═══════════════════════════════════
import { SKIN_CATALOG } from './skins.js';

const cache = {}, ready = {};
function load(src) {
  if (typeof Image === 'undefined') return Promise.resolve(null);
  return cache[src] ||= new Promise(r => { const i = new Image(); i.onload = () => { ready[src] = i; r(i); }; i.onerror = () => r(null); i.src = src; });
}
// Načíst všechny doplňky předem → kreslí se synchronně spolu s greamíkem (žádné problikávání)
export function preloadAccessories() { SKIN_CATALOG.accessories.forEach(a => a.img && load(a.img)); }
export const accById = (id) => SKIN_CATALOG.accessories.find(a => a.id === id) || null;

// Kotvy pro každý druh A stádium (ručně změřeno na listech 2×2, buňka 128×128):
//   box  = obsah buňky (alfa > 15) – stejný ořez, jaký dělají kreslící funkce, takže se dá přepočítat do canvasu
//   head = [x středu, y temene, šířka hlavy], eyes = [x, y, rozpětí očí], neck = [x, y, šířka krku]
// Kontrola všech kombinací: tools/greamici.html → „Doplňky“.
export const ANCHORS = {
  lilek_2:   { box: [16, 17, 111, 126], head: [62, 44, 72], eyes: [62, 79, 52], neck: [62, 98, 62] },
  lilek_3:   { box: [13, 16, 113, 127], head: [64, 50, 54], eyes: [65, 76, 46], neck: [64, 86, 46] },
  lilek_4:   { box: [8, 17, 119, 126],  head: [64, 44, 58], eyes: [64, 68, 40], neck: [64, 82, 44] },
  jiskra_2:  { box: [12, 17, 115, 125], head: [62, 34, 70], eyes: [62, 64, 50], neck: [62, 84, 60] },
  jiskra_3:  { box: [12, 17, 114, 127], head: [64, 32, 44], eyes: [64, 70, 40], neck: [64, 84, 44] },
  jiskra_4:  { box: [6, 17, 120, 126],  head: [64, 34, 44], eyes: [64, 60, 30], neck: [64, 76, 40] },
  kamen_2:   { box: [13, 16, 113, 127], head: [64, 36, 64], eyes: [64, 58, 40], neck: [64, 82, 50] },
  kamen_3:   { box: [13, 17, 113, 127], head: [64, 34, 56], eyes: [64, 58, 36], neck: [64, 78, 58] },
  kamen_4:   { box: [15, 17, 111, 126], head: [64, 36, 52], eyes: [64, 52, 28], neck: [64, 68, 44] },
  srodik_2:  { box: [11, 17, 114, 124], head: [64, 28, 80], eyes: [62, 62, 50], neck: [64, 82, 60] },
  srodik_3:  { box: [14, 16, 113, 127], head: [64, 30, 52], eyes: [64, 68, 44], neck: [64, 80, 44] },
  srodik_4:  { box: [5, 19, 122, 126],  head: [64, 30, 60], eyes: [66, 64, 44], neck: [64, 86, 52] },
  vlnka_2:   { box: [9, 18, 117, 124],  head: [62, 28, 74], eyes: [62, 60, 48], neck: [62, 80, 60] },
  vlnka_3:   { box: [8, 20, 119, 127],  head: [62, 30, 48], eyes: [63, 66, 36], neck: [62, 84, 44] },
  vlnka_4:   { box: [5, 21, 122, 126],  head: [66, 28, 52], eyes: [66, 66, 40], neck: [66, 80, 48] },
  atlas_2:   { box: [10, 21, 117, 125], head: [64, 30, 72], eyes: [64, 62, 52], neck: [64, 84, 60] },
  atlas_3:   { box: [11, 17, 115, 127], head: [58, 40, 52], eyes: [58, 66, 38], neck: [60, 80, 54] },
  atlas_4:   { box: [10, 17, 116, 126], head: [64, 36, 56], eyes: [64, 56, 32], neck: [64, 74, 54] },
};
// Jak velký je doplněk vůči kotvě a kolik ho „sedí“ na hlavě (podíl výšky obrázku pod temenem)
const FIT = {
  acc_cap:     { at: 'head', w: 0.74, sink: 0.24 },
  acc_hat:     { at: 'head', w: 0.66, sink: 0.22 },
  acc_crown:   { at: 'head', w: 0.58, sink: 0.24 },
  acc_wizard:  { at: 'head', w: 0.74, sink: 0.18 },
  acc_flowers: { at: 'head', w: 0.92, sink: 0.62 },
  acc_bow:     { at: 'head', w: 0.40, sink: 0.55, dx: 0.32 },
  acc_glasses: { at: 'eyes', w: 1.18 },
  acc_scarf:   { at: 'neck', w: 0.78, top: 0.04 },
};

// rect = { x, y, w, h } obsahu greamíka v pixelech canvasu (ořez podle ANCHORS.box); stage 2–4
export function drawAccessory(ctx, rect, accId, arch, onLate, stage = 2) {
  const a = accById(accId);
  if (!a || !a.img) return;
  const img = ready[a.img];
  if (!img) { load(a.img).then(i => i && onLate && onLate()); return; }
  const an = ANCHORS[`${arch}_${Math.max(2, Math.min(4, stage || 2))}`] || ANCHORS.lilek_2;
  const fit = FIT[a.id] || { at: 'head', w: 0.6, sink: 0.25 };
  const [bx0, by0, bx1, by1] = an.box;
  const sx = rect.w / (bx1 - bx0 + 1), sy = rect.h / (by1 - by0 + 1);
  const X = (cx) => rect.x + (cx - bx0) * sx, Y = (cy) => rect.y + (cy - by0) * sy;
  const [ax, ay, aw] = an[fit.at];
  const w = aw * sx * fit.w, h = w * img.height / img.width;
  let x = X(ax) - w / 2 + (fit.dx || 0) * aw * sx, y;
  if (fit.at === 'head') y = Y(ay) - h * (1 - fit.sink);
  else if (fit.at === 'eyes') y = Y(ay) - h / 2;
  else y = Y(ay) - h * fit.top;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
