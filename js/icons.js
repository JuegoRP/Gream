// ═══════════════════════════════════
//  GREAM — icons.js
//  Jedna sada čárových ikon (24×24, tah 2.2, kulaté konce) pro lištu a hlavičky.
//  V šablonách: <span data-icon="back"></span> → App._decorate() doplní SVG.
// ═══════════════════════════════════

const P = {
  back:   '<path d="M15 5l-7 7 7 7"/>',
  garden: '<path d="M12 21v-8"/><path d="M12 13c0-4.4 3-7.5 8-7.5 0 5-3 7.5-8 7.5z"/><path d="M12 15c0-3.3-2.6-6-7-6 0 4.2 2.6 6 7 6z"/>',
  map:    '<path d="M9 4L3 6.5V20l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
  me:     '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  chart:  '<path d="M5 20v-8M12 20V5M19 20v-5"/>',
  locate: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  worlds: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
};

export function icon(name) {
  const d = P[name];
  return d ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>` : '';
}

// Doplní ikony do všech [data-icon] uvnitř root (jen jednou)
export function fillIcons(root = document) {
  root.querySelectorAll('[data-icon]:not([data-icon-done])').forEach(el => {
    el.innerHTML = icon(el.dataset.icon);
    el.setAttribute('data-icon-done', '');
  });
}
