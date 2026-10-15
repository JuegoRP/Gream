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

// Doladění polohy podle druhu: o kolik níž je „temeno“ (kvůli anténě, uším, kápi…) a kde jsou oči
const TUNE = {
  lilek:  { head: 0.10, eyes: 0.40, neck: 0.62 },
  jiskra: { head: 0.08, eyes: 0.38, neck: 0.60 },
  kamen:  { head: 0.16, eyes: 0.34, neck: 0.58 },
  srodik: { head: 0.10, eyes: 0.42, neck: 0.66 },
  vlnka:  { head: 0.12, eyes: 0.40, neck: 0.62 },
  atlas:  { head: 0.14, eyes: 0.40, neck: 0.62 },
};

// rect = { x, y, w, h } obsahu greamíka v pixelech canvasu
export function drawAccessory(ctx, rect, accId, arch, onLate) {
  const a = accById(accId);
  if (!a || !a.img) return;
  const img = ready[a.img];
  if (!img) { load(a.img).then(i => i && onLate && onLate()); return; }   // ještě se načítá → překreslit potom
  const t = TUNE[arch] || TUNE.lilek;
  let w, x, y;
  if (a.slot === 'face') { w = rect.w * 0.5; x = rect.x + (rect.w - w) / 2; const h = w * img.height / img.width; y = rect.y + rect.h * t.eyes - h / 2; }
  else if (a.slot === 'neck') { w = rect.w * 0.46; x = rect.x + (rect.w - w) / 2; y = rect.y + rect.h * t.neck; }
  else { // head
    const bow = a.id === 'acc_bow';
    w = rect.w * (bow ? 0.36 : a.id === 'acc_wizard' ? 0.5 : 0.48);
    const h = w * img.height / img.width;
    x = rect.x + (rect.w - w) / 2 + (bow ? rect.w * 0.2 : 0);
    y = rect.y + rect.h * t.head - h * (bow ? 0.4 : 0.78);
  }
  const h = w * img.height / img.width;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
