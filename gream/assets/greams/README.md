# GREAMS Assets Folder

## How to replace placeholder sprites with your hand-crafted Greams

The engine looks for sprites at this exact path pattern:

```
assets/greams/{archetype}_{stage}.png
```

### Required files (18 total)

| File                  | Description                          |
|-----------------------|--------------------------------------|
| `lesni_1.png`         | Forest Gream — baby (Nature)         |
| `lesni_2.png`         | Forest Gream — young                 |
| `lesni_3.png`         | Forest Gream — adult                 |
| `knihovni_1.png`      | Bookish Gream — baby (Language)      |
| `knihovni_2.png`      | Bookish Gream — young                |
| `knihovni_3.png`      | Bookish Gream — adult                |
| `krystalovy_1.png`    | Crystal Gream — baby (Logic)         |
| `krystalovy_2.png`    | Crystal Gream — young                |
| `krystalovy_3.png`    | Crystal Gream — adult                |
| `srdickovy_1.png`     | Heart Gream — baby (Feelings)        |
| `srdickovy_2.png`     | Heart Gream — young                  |
| `srdickovy_3.png`     | Heart Gream — adult                  |
| `paletkovy_1.png`     | Palette Gream — baby (Arts)          |
| `paletkovy_2.png`     | Palette Gream — young                |
| `paletkovy_3.png`     | Palette Gream — adult                |
| `hvezdny_1.png`       | Star Gream — baby (World)            |
| `hvezdny_2.png`       | Star Gream — young                   |
| `hvezdny_3.png`       | Star Gream — adult                   |

### Specifications

- **Size:** 32×32 pixels (engine displays at 160×160 with crisp pixel scaling)
- **Format:** PNG with transparent background
- **No anti-aliasing** — pixel-perfect

### Layout zones (within 32×32 canvas)

```
y=0–6:    Top space (for accessory layer, future)
y=4–16:   Head zone (eyes around y=8–10, mouth around y=12–14)
y=14–22:  Body zone (with arms on sides)
y=22–30:  Legs zone
y=30–32:  Bottom space (for shadow/animations)
```

### Tested workflow

1. Generate concept in Canva AI (using the prompt we made)
2. Export as PNG
3. Use [Pixel It](https://pixelit.app) to convert to true 32×32 pixel art
4. Final touches in [Pixilart](https://pixilart.com) — fix outline, refine details
5. Save with exact filename from table above

When you replace a file, **clear browser cache** (Cmd+Shift+R or DevTools → Application → Clear Storage) so the new sprite loads.

### Future expansion

Once base 18 are done:
- Add overlay PNGs for accessories: `accessory_cap.png`, `accessory_leaves.png`, etc.
- Add shiny variants will be auto-generated (color overlay)
- Add animation frames: `lesni_1_idle_2.png`, `lesni_1_idle_3.png` for blink/walk
