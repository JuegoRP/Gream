const store = new Map();
globalThis.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), clear: () => store.clear() };
const { Gream } = await import(process.cwd() + '/js/gream.js');
let shiny = 0, N = 2000;
for (let i = 0; i < N; i++) { store.clear(); Gream.createStarter('p'); Gream.devAdvanceStage('p', 'nature'); Gream.devAdvanceStage('p', 'nature'); if (Gream.active('p').isShiny) shiny++; }
console.log('zářivých po 2 vývojích:', shiny, '/', N);
