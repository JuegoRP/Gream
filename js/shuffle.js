// Férové zamíchání (Fisher–Yates). Pozor: arr.sort(() => Math.random() - 0.5) míchá zaujatě –
// u 3 možností nechala správnou (v datech první) odpověď na 1. místě ve 44 % případů místo 33 %.
export function shuffle(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
