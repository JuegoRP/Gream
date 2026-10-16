# Zaplní průhledné „díry“ uvnitř greamíků (tvář Kámena 4, zorničky Atlasu 4, odlesky v očích),
# kterými v aréně a zahradě prosvítalo pozadí. Mezery mezi končetinami zůstávají průhledné.
# Spuštění: python3 scripts/fix-sprite-holes.py   (idempotentní – po opravě už díry nenajde)
from PIL import Image
from collections import deque
WHITE = (255, 255, 255, 255)
# sprite: [(y_min, y_max, barva)] – výplň jen děr, jejichž střed leží v tomto pásu (souřadnice buňky 128×128)
RULES = {
    'kamen_4':  [(40, 75, (19, 38, 58, 255))],      # obrazovka = tmavý štít jako u stádia 2 a 3
    'atlas_4':  [(48, 67, (43, 28, 16, 255))],      # zorničky
    'atlas_2':  [(55, 68, WHITE)],
    'vlnka_2':  [(52, 63, WHITE)],
    'jiskra_2': [(58, 72, WHITE)],
}
def holes(px):
    tr = lambda x, y: px[x, y][3] < 200
    q = deque(p for p in [(x, y) for x in range(128) for y in (0, 127)] + [(x, y) for y in range(128) for x in (0, 127)] if tr(*p))
    seen = set(q)
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if 0 <= n[0] < 128 and 0 <= n[1] < 128 and n not in seen and tr(*n): seen.add(n); q.append(n)
    rest = {(x, y) for x in range(128) for y in range(128) if tr(x, y) and (x, y) not in seen}
    comps = []
    while rest:
        st = rest.pop(); c = [st]; q = deque([st])
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (x + dx, y + dy)
                if n in rest: rest.remove(n); c.append(n); q.append(n)
        comps.append(c)
    return comps
for name, rules in RULES.items():
    path = f'img/greamici/{name}.png'
    im = Image.open(path).convert('RGBA'); n = 0
    for cy in (0, 128):
        cell = im.crop((128, cy, 256, cy + 128)); px = cell.load()
        for c in holes(px):
            my = sum(p[1] for p in c) / len(c)
            for y0, y1, col in rules:
                if y0 <= my <= y1:
                    for p in c: px[p] = col
                    n += len(c)
        im.paste(cell, (128, cy))
    im.save(path, optimize=True); print(name, 'zaplněno px:', n)
