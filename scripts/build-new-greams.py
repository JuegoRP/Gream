# Převod vygenerovaných greamíků (Assety/greamici-podkategorie/<jméno>_<stádium>.png, 1024 px, průhledné pozadí)
# na herní list 256×256 (buňka 128 px vpravo nahoře = smutný, vpravo dole = veselý; zde stejné).
# Uzavřené průhledné „díry“ (oči, číslice, záře) se vyplní barvou předlohy na světlém podkladu.
# python3 scripts/build-new-greams.py
from PIL import Image
from collections import deque
SIZE = {2: 98, 3: 106, 4: 114}
NAMES = 'tlapka kanka poctik hrejik noticka mapka hvezdik mnamka bajka ahojik banka hadak mozik zdravik klapka maska micek lvicek'.split()
def holes(px, N=128):
    tr = lambda x, y: px[x, y][3] < 200
    q = deque(p for p in [(x, y) for x in range(N) for y in (0, N - 1)] + [(x, y) for y in range(N) for x in (0, N - 1)] if tr(*p)); seen = set(q)
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            m = (x + dx, y + dy)
            if 0 <= m[0] < N and 0 <= m[1] < N and m not in seen and tr(*m): seen.add(m); q.append(m)
    rest = {(x, y) for x in range(N) for y in range(N) if tr(x, y) and (x, y) not in seen}; comps = []
    while rest:
        s = rest.pop(); c = [s]; q = deque([s])
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                m = (x + dx, y + dy)
                if m in rest: rest.remove(m); c.append(m); q.append(m)
        comps.append(c)
    return comps
# Kaňka 2 má z generátoru prázdné bílé oči → domalovat tmavé oči s odleskem (jako ostatní greamíci)
DARK_EYES = {('kanka', 2)}
def dark_eyes(px):
    W = {(x, y) for x in range(128) for y in range(40, 100) if px[x, y][3] > 0 and sum(px[x, y][:3]) > 600}
    seen, comps = set(), []
    for p in W:
        if p in seen: continue
        c = [p]; q = deque([p]); seen.add(p)
        while q:
            x, y = q.popleft()
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    m = (x + dx, y + dy)
                    if m in W and m not in seen: seen.add(m); c.append(m); q.append(m)
        comps.append(c)
    for c in sorted(comps, key=len, reverse=True)[:2]:
        xs = [p[0] for p in c]; ys = [p[1] for p in c]; x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        for x in range(x0 - 1, x1 + 2):
            for y in range(y0 - 1, y1 + 2):
                if (x, y) in c or (px[x, y][3] > 0 and sum(px[x, y][:3]) > 400): px[x, y] = (24, 18, 40, 255)
        for d in ((1, 1), (2, 1), (1, 2), (2, 2)): px[x0 + d[0], y0 + d[1]] = (255, 255, 255, 255)
# Hvězdík 4: bílý pás mezi prstencem planet a hlavou → průhledný (odlesky na planetách zůstanou)
def white_band(px):
    for y in range(64):
        for x in range(128):
            if 44 < x < 84 and y >= 40: continue
            r, g, b, a = px[x, y]
            if not a or not (r > 150 and g > 150 and b > 150 and max(r, g, b) - min(r, g, b) < 50): continue
            nb = [px[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < 128 and 0 <= y + dy < 128]
            if sum(1 for v in nb if v[3] and not (v[0] > 150 and v[1] > 150 and v[2] > 150)) >= 4: continue
            px[x, y] = (0, 0, 0, 0)
for n in NAMES:
    for st in (2, 3, 4):
        src = Image.open(f'Assety/greamici-podkategorie/{n}_{st}.png').convert('RGBA')
        bb = src.split()[3].point(lambda v: 255 if v > 100 else 0).getbbox(); src = src.crop(bb)
        k = SIZE[st] / max(src.size); w, h = max(1, round(src.width * k)), max(1, round(src.height * k))
        sm = src.resize((w, h), Image.BOX)
        light = Image.new('RGBA', (w, h), (250, 250, 244, 255)); light.alpha_composite(sm)   # barva předlohy na světlém podkladu
        px, lp = sm.load(), light.load()
        for y in range(h):
            for x in range(w):
                r, g, b, al = px[x, y]; px[x, y] = (r, g, b, 255 if al > 110 else 0)
        cell = Image.new('RGBA', (128, 128), (0, 0, 0, 0)); ox, oy = (128 - w) // 2, 126 - h; cell.paste(sm, (ox, oy), sm)
        cp = cell.load()
        for c in holes(cp):
            pass   # i malé díry (odlesky v očích) – jinak prosvítá pozadí
            for (x, y) in c:
                sx, sy = x - ox, y - oy
                if 0 <= sx < w and 0 <= sy < h: cp[x, y] = lp[sx, sy]
        if (n, st) in DARK_EYES: dark_eyes(cp)
        if (n, st) == ('hvezdik', 4): white_band(cp)
        sheet = Image.new('RGBA', (256, 256), (0, 0, 0, 0)); sheet.paste(cell, (128, 0)); sheet.paste(cell, (128, 128))
        sheet.save(f'img/greamici/{n}_{st}.png', optimize=True)
print('hotovo')
