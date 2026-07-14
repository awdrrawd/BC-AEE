const FALLBACK_RGB: Rgb = {r: 128, g: 128, b: 128};

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  let value = hex.trim().replace('#', '');
  if (value.length === 3) value = value.split('').map(char => char + char).join('');
  if (!/^[0-9a-f]{6}$/i.test(value)) return FALLBACK_RGB;

  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

export function rgba({r, g, b}: Rgb, alpha: number): string {
  return `rgba(${r},${g},${b},${alpha})`;
}

export function hexToRgba(hex: string, alpha: number): string {
  return rgba(hexToRgb(hex), alpha);
}

export function darken({r, g, b}: Rgb, amount: number): Rgb {
  return {
    r: Math.max(0, r - amount),
    g: Math.max(0, g - amount),
    b: Math.max(0, b - amount),
  };
}
