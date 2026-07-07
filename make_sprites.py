#!/usr/bin/env python3
"""
Gream sprite sheet generator.
Creates 256x256 sprite sheets (4 quadrants 128x128) from source images.
Layout:
  TL (0,0)   = transparent
  TR (128,0) = sad (blue tint)
  BL (0,128) = transparent
  BR (128,128)= happy (original)
"""

import os
import sys
import shutil
from PIL import Image

ASSETS_DIR = "/Users/roman.pavlorek/Documents/Hra/Mobil/gream/Assety"
OUT_DIR    = "/Users/roman.pavlorek/Documents/Hra/Mobil/gream/img/greamici"

# Mapping: (source filename, output base name, is_jpg)
SPRITE_MAPPINGS = [
    ("Kopie návrhu Návrh bez názvu-9.png",  "atlas_3",  False),
    ("Kopie návrhu Návrh bez názvu-10.png", "srodik_3", False),
    ("Kopie návrhu Návrh bez názvu-11.png", "jiskra_3", False),
    ("Kopie návrhu Návrh bez názvu-12.png", "lilek_3",  False),
    ("Kopie návrhu Návrh bez názvu-13.png", "kamen_3",  False),
    ("Kopie návrhu Návrh bez názvu-14.png", "vlnka_3",  False),
    ("Kopie návrhu Návrh bez názvu-15.png", "lilek_2",  False),
    ("Kopie návrhu Návrh bez názvu-16.png", "vlnka_2",  False),
    ("Kopie návrhu Návrh bez názvu-17.png", "jiskra_2", False),
    ("Kopie návrhu Návrh bez názvu-18.png", "srodik_2", False),
    ("Kopie návrhu Návrh bez názvu-19.png", "atlas_2",  False),
    ("Kopie návrhu Návrh bez názvu-20.png", "jiskra_4", False),
    ("Kopie návrhu Návrh bez názvu-21.png", "lilek_4",  False),
    ("Kopie návrhu Návrh bez názvu-23.png", "srodik_4", False),
    ("Kopie návrhu Návrh bez názvu-24.png", "atlas_4",  False),
    ("Kopie návrhu Návrh bez názvu-25.png", "vlnka_4",  False),
    ("Kopie návrhu Návrh bez názvu-26.png", "kamen_4",  False),
    ("gemini-2.5-flash-image_do_a_baby_version_of_the_robot.-0.jpg", "kamen_2", True),
]

SEED_SRC  = "Kopie návrhu Návrh bez názvu-7.png"
SEED_DEST = "seed_1.png"

INNER_SIZE = 112   # content fits in 112x112 within each 128x128 quadrant
QUAD_SIZE  = 128
SHEET_SIZE = 256


def remove_white_bg(img, tolerance=30):
    """Flood-fill white/light background from corners → transparent."""
    img = img.convert("RGBA")
    data = img.load()
    w, h = img.size
    visited = [[False]*h for _ in range(w)]
    stack = []

    def is_light(px):
        r, g, b, a = px
        return a > 200 and r > (255 - tolerance) and g > (255 - tolerance) and b > (255 - tolerance)

    # Seed from all four corners
    corners = [(0,0), (w-1,0), (0,h-1), (w-1,h-1)]
    for cx, cy in corners:
        if not visited[cx][cy] and is_light(data[cx, cy]):
            stack.append((cx, cy))

    while stack:
        x, y = stack.pop()
        if x < 0 or x >= w or y < 0 or y >= h:
            continue
        if visited[x][y]:
            continue
        visited[x][y] = True
        if not is_light(data[x, y]):
            continue
        # Make transparent
        r, g, b, a = data[x, y]
        data[x, y] = (r, g, b, 0)
        stack.extend([(x+1,y),(x-1,y),(x,y+1),(x,y-1)])

    return img


def scale_to_fit(img, max_size):
    """Scale image to fit within max_size x max_size, preserving aspect ratio."""
    w, h = img.size
    if w == 0 or h == 0:
        return img
    scale = min(max_size / w, max_size / h)
    new_w = max(1, int(w * scale))
    new_h = max(1, int(h * scale))
    return img.resize((new_w, new_h), Image.LANCZOS)


def get_content_bbox(img):
    """Return bounding box of non-transparent pixels."""
    r, g, b, a = img.split()
    bbox = a.getbbox()
    return bbox  # (left, top, right, bottom) or None


def crop_to_content(img):
    """Crop image to its non-transparent content bounding box."""
    bbox = get_content_bbox(img)
    if bbox:
        return img.crop(bbox)
    return img


def place_bottom_center(content, quad_size):
    """Place content image centered horizontally, bottom-aligned in quad."""
    quad = Image.new("RGBA", (quad_size, quad_size), (0, 0, 0, 0))
    cw, ch = content.size
    # Center horizontal
    x = (quad_size - cw) // 2
    # Bottom align: bottom of content at quad_size - 1
    y = quad_size - ch
    y = max(0, y)
    quad.paste(content, (x, y), content)
    return quad


def apply_sad_tint(img):
    """Apply blue tint overlay to non-transparent pixels."""
    result = img.copy().convert("RGBA")
    overlay = Image.new("RGBA", img.size, (40, 100, 200, 60))
    # Mask: use alpha channel of original
    r, g, b, a = img.split()
    # Create mask from alpha
    mask = a
    result = Image.composite(
        Image.alpha_composite(result, overlay),
        result,
        mask
    )
    return result


def make_sprite_sheet(src_path, out_name, is_jpg=False):
    out_path = os.path.join(OUT_DIR, out_name + ".png")
    print(f"Processing: {os.path.basename(src_path)} → {out_name}.png")

    # Open source
    img = Image.open(src_path)

    # Remove background for JPG or if image has no alpha
    if is_jpg or img.mode != "RGBA" or get_content_bbox(img.convert("RGBA")) == img.convert("RGBA").getbbox():
        # Convert to RGBA first
        img = img.convert("RGBA")
        if is_jpg:
            img = remove_white_bg(img, tolerance=30)
        elif img.mode == "RGB":
            img = img.convert("RGBA")
    else:
        img = img.convert("RGBA")

    # For PNG files that might have white bg but no alpha in source
    if img.mode == "RGBA":
        # Check if mostly non-transparent (no real alpha = needs bg removal)
        r, g, b, a = img.split()
        alpha_data = list(a.getdata())
        # If more than 90% pixels are fully opaque, try bg removal
        opaque_count = sum(1 for v in alpha_data if v > 200)
        total = len(alpha_data)
        if opaque_count / total > 0.90 and not is_jpg:
            # Try to remove white/light background
            img = remove_white_bg(img, tolerance=40)

    # Crop to content
    img = crop_to_content(img)

    # Scale to fit INNER_SIZE x INNER_SIZE
    img = scale_to_fit(img, INNER_SIZE)

    # Create happy quadrant (BR)
    happy_quad = place_bottom_center(img, QUAD_SIZE)

    # Create sad quadrant (TR) — blue tint
    sad_quad = place_bottom_center(apply_sad_tint(img), QUAD_SIZE)

    # Build 256x256 sprite sheet
    sheet = Image.new("RGBA", (SHEET_SIZE, SHEET_SIZE), (0, 0, 0, 0))
    # TL (0,0) = transparent — already blank
    # TR (128,0) = sad
    sheet.paste(sad_quad, (QUAD_SIZE, 0), sad_quad)
    # BL (0,128) = transparent — already blank
    # BR (128,128) = happy
    sheet.paste(happy_quad, (QUAD_SIZE, QUAD_SIZE), happy_quad)

    sheet.save(out_path, "PNG")
    print(f"  Saved: {out_path}")


def copy_seed(src_path, dest_name):
    """Copy seed image directly (no sprite sheet)."""
    dest_path = os.path.join(OUT_DIR, dest_name)
    img = Image.open(src_path).convert("RGBA")
    img.save(dest_path, "PNG")
    print(f"Copied seed: {src_path} → {dest_path}")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    errors = []

    # Process sprite sheets
    for src_name, out_name, is_jpg in SPRITE_MAPPINGS:
        src_path = os.path.join(ASSETS_DIR, src_name)
        if not os.path.exists(src_path):
            print(f"  WARNING: source not found: {src_path}")
            errors.append(src_name)
            continue
        try:
            make_sprite_sheet(src_path, out_name, is_jpg=is_jpg)
        except Exception as e:
            print(f"  ERROR processing {src_name}: {e}")
            errors.append(src_name)

    # Copy seed image directly
    seed_src = os.path.join(ASSETS_DIR, SEED_SRC)
    if os.path.exists(seed_src):
        copy_seed(seed_src, SEED_DEST)
    else:
        print(f"  WARNING: seed source not found: {seed_src}")
        errors.append(SEED_SRC)

    print(f"\nDone! {len(SPRITE_MAPPINGS) + 1 - len(errors)} files created, {len(errors)} errors.")
    if errors:
        print("Errors:", errors)


if __name__ == "__main__":
    main()
