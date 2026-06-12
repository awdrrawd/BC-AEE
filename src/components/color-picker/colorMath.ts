import type {HsvColor} from '@/components/color-picker/types';

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function hsvToRgb(h: number, s: number, v: number) {
  s /= 100;
  v /= 100;
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)] as const;
}

export function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(value => value.toString(16).padStart(2, '0').toUpperCase()).join('');
}

export function hsvToHex(h: number, s: number, v: number) {
  return rgbToHex(...hsvToRgb(h, s, v));
}

export function hexToHsv(hex: string): HsvColor {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return {h: 220, s: 70, v: 90};
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return {h: Math.round(h), s: Math.round(max ? d / max * 100 : 0), v: Math.round(max * 100)};
}

export function hsvaString(h: number, s: number, v: number, a: number) {
  const [r, g, b] = hsvToRgb(h, s, v);
  return `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
}
