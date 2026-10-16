# Značka Gream: z Assety/brand/logo.png a icon.png (zdroj 1024 px, OpenAI images) vyrobí všechny velikosti.
#   python3 scripts/build-brand.py
# Logo: img/logo/gream-logo.png (+@1x); ikony: favicon.ico, icons/*, Android mipmap-* (adaptivní i klasické), splash.
# Varianty k výběru: GDrive Gream/brand/varianty (logo_a/b/c, icon_a/b/c) – pro jinou stačí přepsat logo.png / icon.png a spustit znovu.
from PIL import Image, ImageFilter, ImageDraw
import os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(R, *a)
BG = (203, 227, 160, 255)   # #cbe3a0 – barva načítací obrazovky (splash na ni plynule navazuje)

logo = Image.open(P('Assety/brand/logo.png')).convert('RGBA')
logo = logo.crop(logo.getbbox())
os.makedirs(P('img/logo'), exist_ok=True)
for w, name in [(720, 'gream-logo.png'), (360, 'gream-logo@1x.png')]:
    l = logo.resize((w, round(logo.height * w / logo.width)), Image.LANCZOS)
    l.quantize(256, method=Image.Quantize.FASTOCTREE).save(P('img/logo', name), optimize=True)   # paleta: menší soubor pro první načtení

icon = Image.open(P('Assety/brand/icon.png')).convert('RGBA').resize((1024, 1024), Image.LANCZOS)
def sq(n): return icon.resize((n, n), Image.LANCZOS)
os.makedirs(P('icons'), exist_ok=True)
sq(512).save(P('icons/icon-512.png'), optimize=True)
sq(192).save(P('icons/icon-192.png'), optimize=True)
for n, f in [(180, 'apple-touch-icon.png'), (167, 'apple-touch-icon-167.png'), (152, 'apple-touch-icon-152.png'), (120, 'apple-touch-icon-120.png'), (76, 'apple-touch-icon-76.png')]:
    sq(n).convert('RGB').save(P('icons', f), optimize=True)
sq(256).save(P('favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
sq(32).save(P('icons/favicon-32.png'), optimize=True)

# Maskovatelná / adaptivní: ikona zmenšená do bezpečné zóny, okraj = rozmazané zvětšené pozadí ikony (žádné ostré hrany)
def padded(n, inner):
    back = icon.resize((n, n), Image.LANCZOS).filter(ImageFilter.GaussianBlur(n / 18))
    k = round(n * inner); top = icon.resize((k, k), Image.LANCZOS)
    f = max(2, round(k * 0.12))   # měkký okraj vloženého čtverce, ať nevzniká viditelná hrana
    m = Image.new('L', (k, k), 0); ImageDraw.Draw(m).rectangle((f, f, k - 1 - f, k - 1 - f), fill=255)
    top.putalpha(m.filter(ImageFilter.GaussianBlur(f / 2)))
    back.alpha_composite(top, ((n - k) // 2, (n - k) // 2))
    return back
padded(512, 0.80).save(P('icons/icon-maskable-512.png'), optimize=True)
padded(512, 0.80).save(P('Assety/brand/play-store-icon-512.png'), optimize=True)   # pro Google Play Console

# Android: klasická (čtverec se zaoblením / kruh) + adaptivní popředí 108 dp (viditelných 72 dp)
dens = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for d, k in dens.items():
    base = P('android/app/src/main/res', 'mipmap-' + d)
    if not os.path.isdir(base): continue
    n = round(48 * k)
    m = Image.new('L', (n, n), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, n - 1, n - 1), radius=round(n * 0.18), fill=255)
    i = sq(n); i.putalpha(m); i.save(os.path.join(base, 'ic_launcher.png'), optimize=True)
    m = Image.new('L', (n, n), 0); ImageDraw.Draw(m).ellipse((0, 0, n - 1, n - 1), fill=255)
    i = sq(n); i.putalpha(m); i.save(os.path.join(base, 'ic_launcher_round.png'), optimize=True)
    padded(round(108 * k), 0.80).save(os.path.join(base, 'ic_launcher_foreground.png'), optimize=True)

# Splash (Android): logo na barvě načítací obrazovky
for root, dirs, files in os.walk(P('android/app/src/main/res')):
    if 'splash.png' in files:
        f = os.path.join(root, 'splash.png'); W, H = Image.open(f).size
        s = Image.new('RGBA', (W, H), BG)
        w = round(min(W, H) * 0.72); l = logo.resize((w, round(logo.height * w / logo.width)), Image.LANCZOS)
        s.alpha_composite(l, ((W - l.width) // 2, (H - l.height) // 2 - round(H * 0.03)))
        s.convert('RGB').save(f, optimize=True)
print('hotovo')
