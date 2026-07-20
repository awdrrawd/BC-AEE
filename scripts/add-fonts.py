#!/usr/bin/env python3
"""
Register item fonts for AEE with zero manual bookkeeping.

Workflow:
  1. Drop a .ttf / .otf / .woff2 into releases/download/fonts/
  2. (Optional) add a SourceRecord.md note yourself
  3. Run:  python scripts/add-fonts.py

For every font file that isn't already listed in src/core/fonts.ts it will:
  - validate the font with OTS (the exact OpenType Sanitizer browsers use);
    a byte-valid font that a browser would reject ("Invalid font data in
    ArrayBuffer") is caught here, not at runtime.
  - auto-repair the common failure (a broken `post` table -> rebuild as
    version 3.0, which drops glyph names that rendering doesn't need) and
    re-validate, overwriting the file in place if the repair worked.
  - read the display name from the font's own name table.
  - derive a stable id from the file name.
  - append a CUSTOM_FONTS entry to src/core/fonts.ts.

Existing entries are never touched, so re-running is safe/idempotent.

Requires: pip install fonttools opentype-sanitizer
After it runs: rebuild the script (npx vite build), then commit AND push
(fonts are fetched from raw.githubusercontent .../main/, so unpushed = not live).
"""
from __future__ import annotations

import re
import sys
import tempfile
from pathlib import Path

# Font names are often CJK; the Windows console defaults to a legacy codepage.
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

try:
    import ots
    from fontTools.ttLib import TTFont, newTable
except ImportError:
    sys.exit("Missing deps. Run:  pip install fonttools opentype-sanitizer")

REPO = Path(__file__).resolve().parent.parent
FONTS_DIR = REPO / "releases" / "download" / "fonts"
FONTS_TS = REPO / "src" / "core" / "fonts.ts"
FONT_EXTS = {".ttf", ".otf", ".woff2", ".woff"}


def slug(name: str) -> str:
    """Stable, url-safe id from a file stem (ASCII only; CJK/symbols dropped)."""
    s = re.sub(r"[^a-zA-Z0-9]+", "-", name).strip("-").lower()
    return s or "font"


def ots_error(path: Path) -> str | None:
    """Return OTS's error text if the browser sanitizer would reject the font, else None."""
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "out.ttf"
        result = ots.sanitize(str(path), str(out), capture_output=True)
        if result.returncode == 0:
            return None
        return (result.stderr or b"").decode("utf-8", "replace").strip() or "unknown OTS error"


def rebuild_post_v3(path: Path) -> None:
    """Replace a broken `post` table with a clean version 3.0 (no glyph names)."""
    font = TTFont(str(path))
    n = font["maxp"].numGlyphs
    # Pin a synthetic glyph order so save() never consults the broken post table.
    font.setGlyphOrder([".notdef"] + [f"glyph{i:05d}" for i in range(1, n)])
    post = newTable("post")
    post.formatType = 3.0
    post.italicAngle = 0.0
    post.underlinePosition = -75
    post.underlineThickness = 50
    post.isFixedPitch = 0
    post.minMemType42 = post.maxMemType42 = post.minMemType1 = post.maxMemType1 = 0
    font["post"] = post
    font.save(str(path))


def display_name(path: Path) -> str:
    """Human-readable family name from the font's own name table, with a file-stem fallback."""
    try:
        name = TTFont(str(path))["name"]
        return name.getDebugName(16) or name.getDebugName(1) or path.stem
    except Exception:
        return path.stem


def make_web_safe(path: Path) -> str | None:
    """Ensure the font passes OTS, repairing in place if possible. Returns a status string."""
    err = ots_error(path)
    if err is None:
        return "ok"
    if "post" in err.lower():
        rebuild_post_v3(path)
        if ots_error(path) is None:
            return "repaired (post -> 3.0)"
    return f"FAILED OTS: {err}"


def registered(fonts_ts: str) -> tuple[set[str], set[str]]:
    files = set(re.findall(r"file:\s*'([^']+)'", fonts_ts))
    ids = set(re.findall(r"id:\s*'([^']+)'", fonts_ts))
    return files, ids


def unique_id(base: str, taken: set[str]) -> str:
    if base not in taken:
        return base
    i = 2
    while f"{base}-{i}" in taken:
        i += 1
    return f"{base}-{i}"


def esc(text: str) -> str:
    return text.replace("\\", "\\\\").replace("'", "\\'")


def main() -> int:
    src = FONTS_TS.read_text(encoding="utf-8")
    known_files, known_ids = registered(src)

    candidates = sorted(
        p for p in FONTS_DIR.iterdir()
        if p.suffix.lower() in FONT_EXTS and p.name not in known_files
    )
    if not candidates:
        print("No new fonts to add — everything in the folder is already registered.")
        return 0

    new_lines: list[str] = []
    failures = 0
    for path in candidates:
        status = make_web_safe(path)
        if status.startswith("FAILED"):
            print(f"  [FAIL] {path.name}: {status}")
            failures += 1
            continue
        font_id = unique_id(slug(path.stem), known_ids)
        known_ids.add(font_id)
        name = display_name(path)
        size = path.stat().st_size  # after any in-place repair
        note = "" if status == "ok" else f"  ({status})"
        print(f"  [OK]   {path.name}: id={font_id} name={name!r} size={size}{note}")
        new_lines.append(
            f"  {{id: '{esc(font_id)}', name: '{esc(name)}', file: '{esc(path.name)}', size: {size}}},"
        )

    if new_lines:
        # Insert before the closing `];` of the CUSTOM_FONTS array.
        m = re.search(r"(export const CUSTOM_FONTS[^\[]*\[.*?)(\n\];)", src, re.DOTALL)
        if not m:
            sys.exit("Could not locate the CUSTOM_FONTS array in fonts.ts")
        updated = m.group(1) + "\n" + "\n".join(new_lines) + m.group(2)
        src = src[:m.start()] + updated + src[m.end():]
        FONTS_TS.write_text(src, encoding="utf-8")
        print(f"\nAdded {len(new_lines)} font(s) to {FONTS_TS.relative_to(REPO)}")

    if failures:
        print(f"\n{failures} font(s) could not be made web-safe — handle those manually.")
    print("\nNext: npx vite build, then commit AND push (fonts load from GitHub main).")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
