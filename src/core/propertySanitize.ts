// BC-R134-COMPAT: pure validators for the two non-native Item.Property fields AEE owns
// (LayerOverrides, wceOverrideHide) and the Free Draw board fields (CustomDraw, CustomDrawSPS, OffsetX,
// OffsetY, MaskPriority). No BC globals are touched here so they can be unit tested.
//
// Why they exist: since R134 BC's ItemPropertiesValidate() is wired into ExtendedItemInit(),
// ValidationSanitizeProperties() and ItemPropertiesDecompress(), and it rebuilds Item.Property from
// PropertyData entries only. Fields without an entry are silently dropped, even though
// ItemPropertiesGetBundleProperties() still whitelists them for upload. The hook in
// hooks/propertyCompatHooks.ts puts them back after validation, but only if they pass these checks,
// because the source may be another player's appearance data.

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_LAYERS = 128;
const MAX_HIDE_GROUPS = 128;
const MAX_JSON_LENGTH = 32768;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === 'object' && !Array.isArray(value);
const isNumberIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

/** Allowed range per known LayerOverrides key (generous: AEE sliders are well inside these). */
const NUMBER_RANGES: Record<string, [number, number]> = {
  Opacity: [0, 1],
  ScaleX: [-100, 100],
  ScaleY: [-100, 100],
  Rotation: [-3600, 3600],
  SkewX: [-1000, 1000],
  SkewY: [-1000, 1000],
  MirrorCopyAxisX: [-100, 100],
  MirrorCopyAxisY: [-100, 100],
};
const BOOLEAN_KEYS = new Set(['FlipX', 'FlipY', 'MirrorCopy', 'MirrorCopyV']);
const POSITION_KEYS = new Set(['DrawingLeft', 'DrawingTop']);

function sanitizePosition(value: unknown): Record<string, number> | null {
  if (!isPlainObject(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > 8) return null;
  const out: Record<string, number> = {};
  for (const [key, v] of entries) {
    if (FORBIDDEN_KEYS.has(key) || key.length > 64 || !isNumberIn(v, -10000, 10000)) continue;
    out[key] = v;
  }
  return Object.keys(out).length ? out : null;
}

function sanitizeLayerEntry(entry: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!isPlainObject(entry)) return out;
  for (const [key, value] of Object.entries(entry)) {
    if (FORBIDDEN_KEYS.has(key) || key.length > 64) continue;
    if (POSITION_KEYS.has(key)) {
      const position = sanitizePosition(value);
      if (position) out[key] = position;
    } else if (key in NUMBER_RANGES) {
      const [min, max] = NUMBER_RANGES[key];
      if (isNumberIn(value, min, max)) out[key] = value;
    } else if (BOOLEAN_KEYS.has(key)) {
      if (typeof value === 'boolean') out[key] = value;
    } else if (typeof value === 'boolean' || isNumberIn(value, -1e6, 1e6)
      || (typeof value === 'string' && value.length <= 64)) {
      // Unknown key (the field is shared with LSCG): keep flat primitives, drop anything nested.
      out[key] = value;
    }
  }
  return out;
}

/** Returns a sanitized copy, or null when the value is not a usable LayerOverrides array. */
export function sanitizeLayerOverrides(value: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(value) || value.length > MAX_LAYERS) return null;
  const out = Array.from(value, entry => sanitizeLayerEntry(entry));
  try {
    if (JSON.stringify(out).length > MAX_JSON_LENGTH) return null;
  } catch {
    return null;
  }
  return out;
}

/** Returns a de-duplicated copy of real group names, or null when the value is unusable. */
export function sanitizeHideOverride(value: unknown, groupExists: (name: string) => boolean): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_HIDE_GROUPS) return null;
  const out: string[] = [];
  for (const name of value) {
    if (typeof name !== 'string' || !groupExists(name)) return null;
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

export interface FreeDrawRestoreDeps {
  /** True when the string is a valid (compressed) png/webp data URL; see freeDraw/drawSource.ts. */
  isDrawSource: (value: unknown) => boolean;
  /** Normalized copy of a CustomDrawSPS reference, or null when invalid; see freeDraw/spsDrawing.ts. */
  readSpsRef: (property: Record<string, unknown>) => Record<string, unknown> | null;
}

const FREE_DRAW_OFFSET_LIMIT = 10000;
const FREE_DRAW_PRIORITY: [number, number] = [0, 99];

/**
 * BC-R134-COMPAT: the fields of an AEE Free Draw board (ItemCanvasN/DrawingBoard). R134's
 * ItemPropertiesValidate() drops them (no PropertyData entry), after which the NOARCH Init resets the
 * board to its baseline, i.e. the drawing is gone. Returns only values that pass validation; the source
 * may be another player's appearance data.
 */
export function sanitizeFreeDrawProperties(source: unknown, deps: FreeDrawRestoreDeps): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!isPlainObject(source)) return out;
  if (typeof source.CustomDraw === 'string' && source.CustomDraw && deps.isDrawSource(source.CustomDraw)) {
    out.CustomDraw = source.CustomDraw;
  }
  if (source.CustomDrawSPS != null) {
    const ref = isPlainObject(source.CustomDrawSPS) ? deps.readSpsRef(source) : null;
    if (ref) out.CustomDrawSPS = {...ref};
  }
  for (const key of ['OffsetX', 'OffsetY'] as const) {
    if (isNumberIn(source[key], -FREE_DRAW_OFFSET_LIMIT, FREE_DRAW_OFFSET_LIMIT)) out[key] = source[key];
  }
  const priority = source.MaskPriority;
  if (Number.isInteger(priority) && isNumberIn(priority, FREE_DRAW_PRIORITY[0], FREE_DRAW_PRIORITY[1])) {
    out.MaskPriority = priority;
  }
  return out;
}
