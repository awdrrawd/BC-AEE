import type {CSSProperties} from 'react';

/**
 * All panels share one zoom capability decision. Dimensions are design-space units;
 * at contains CSS-pixel offsets within the unscaled containing block.
 * Callers fit non-uniform bounds by adjusting layout dimensions, not stretching text.
 * Zoom changes layout, so callers must provide explicit bounds where needed.
 */
export type ScaleAt = { left?: number; top?: number };

let zoomSupported: boolean | null = null;

/** Probe coordinate units rather than browser versions.
 * This does not establish rendering quality or full layout equivalence.
 */
export function supportsStandardZoom(): boolean {
  if (typeof document === 'undefined' || typeof CSS === 'undefined') return false;
  if (zoomSupported !== null) return zoomSupported;
  if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function' || !CSS.supports('zoom', '2')) {
    return (zoomSupported = false);
  }
  const host = document.body ?? document.documentElement;
  if (!host) return false; // too early to probe; do not cache

  let result: boolean;
  const outer = document.createElement('div');
  try {
    outer.style.cssText = 'position:fixed;left:10px;top:0;width:0;height:0;visibility:hidden;pointer-events:none;zoom:2';
    const inner = document.createElement('div');
    inner.style.cssText = 'width:10px;height:10px';
    outer.appendChild(inner);
    host.appendChild(outer);
    result = Math.abs(inner.getBoundingClientRect().width - 20) < 0.5
      && Math.abs(outer.getBoundingClientRect().left - 20) < 0.5
      && inner.offsetWidth === 10;
  } catch {
    result = false;
  } finally {
    outer.remove();
  }
  return (zoomSupported = result);
}

export function scaleStyle(scale: number, at: ScaleAt = {}): CSSProperties {
  const factor = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const style: CSSProperties = {};

  if (supportsStandardZoom()) {
    style.zoom = factor;
    if (at.left !== undefined) style.left = at.left / factor;
    if (at.top !== undefined) style.top = at.top / factor;
    return style;
  }

  style.transform = `scale(${factor})`;
  style.transformOrigin = 'top left';
  if (at.left !== undefined) style.left = at.left;
  if (at.top !== undefined) style.top = at.top;
  return style;
}
