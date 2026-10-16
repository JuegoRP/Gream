// Pořadí otázek: každý hráč jiné (dva noví hráči nesmí dostat stejné otázky → stejného prvního greamíka), bez opakování.
const { playerOrder } = await import('../js/shuffle.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m); } };
for (const n of [1, 2, 7, 60, 97, 150]) {
  const seq = Array.from({ length: n }, (_, i) => playerOrder('p_abc', 'naturemedium', n, i));
  ok(new Set(seq).size === n && seq.every(x => x >= 0 && x < n), `n=${n}: celá sada bez opakování`);
}
const firsts = (pid) => Array.from({ length: 12 }, (_, i) => playerOrder(pid, 'naturemedium', 150, i)).join(',');
const pids = Array.from({ length: 50 }, (_, i) => 'p_' + (1700000000000 + i * 7919).toString(36) + Math.random().toString(36).slice(2, 6));
ok(new Set(pids.map(firsts)).size === 50, '50 hráčů → 50 různých pořadí prvních 12 otázek');
ok(new Set(pids.map(p => playerOrder(p, 'naturemedium', 150, 0))).size >= 30, 'první otázka se u hráčů liší');
ok(playerOrder('p_x', 'naturemedium', 150, 3) === playerOrder('p_x', 'naturemedium', 150, 3), 'pro jednoho hráče stálé');
console.log(`order: ${pass} ok, ${fail} chyb`);
process.exit(fail ? 1 : 0);
