// Shape drawing + flood fill for the free-draw board (board-local coordinates).

import {BOARD_W, BOARD_H} from './constants';

export const SHAPE_TOOLS = [
  'line', 'rect', 'square', 'circle', 'ellipse',
  'triangle', 'rtriangle', 'diamond', 'pentagon', 'hexagon',
  'arrow', 'cross', 'heart', 'star', 'star4',
  'star6', 'burst', 'spade', 'club', 'catpaw',
  'moon', 'lightning', 'flower', 'teardrop',
] as const;

export type ShapeTool = typeof SHAPE_TOOLS[number];

export const SHAPE_EMOJI: Record<string, string> = {
  line: '／', rect: '▭', square: '▢', circle: '◯', ellipse: '⬭',
  triangle: '△', rtriangle: '◺', diamond: '◇', pentagon: '⬠', hexagon: '⬡',
  arrow: '➜', cross: '✚', heart: '♡', star: '☆', star4: '✦',
  star6: '✶', burst: '✴', spade: '♠', club: '♣', catpaw: '🐾',
  moon: '☾', lightning: '⚡', flower: '❀', teardrop: '💧',
};

// N-pointed star centred at (cx,cy), first spike pointing up.
function starPath(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, spikes: number, outerR: number, innerR: number,
) {
  let rot = -Math.PI / 2;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
  for (let i = 0; i < spikes; i++) {
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
  }
  ctx.closePath();
}

export interface ShapeStyle {
  tool: string;
  filled: boolean;
  color: string;
  thickness: number;
  shift?: boolean; // held → constrain: 45° line / square / circle
}

export function drawShapePreview(
  ctx: CanvasRenderingContext2D,
  style: ShapeStyle,
  x0: number, y0: number, x1: number, y1: number,
) {
  ctx.lineWidth = style.thickness;
  ctx.strokeStyle = style.color;
  ctx.fillStyle = style.color;
  // Shift constrains the drag before any shape maths sees it: the line snaps to
  // the nearest 45°, and the box-defined shapes (rect/ellipse) get equal sides,
  // which is what makes them a square / a true circle.
  if (style.shift) {
    if (style.tool === 'line' || style.tool === 'arrow') {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const step = Math.PI / 4;
      const ang = Math.round(Math.atan2(y1 - y0, x1 - x0) / step) * step;
      x1 = x0 + Math.cos(ang) * len;
      y1 = y0 + Math.sin(ang) * len;
    } else if (style.tool === 'rect' || style.tool === 'ellipse') {
      const side = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      x1 = x0 + (x1 < x0 ? -side : side);
      y1 = y0 + (y1 < y0 ? -side : side);
    }
  }
  const w = x1 - x0, h = y1 - y0;
  const r = Math.hypot(w, h);
  const {filled} = style;

  switch (style.tool) {
    case 'line':
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      break;
    case 'rect':
      ctx.beginPath(); ctx.rect(x0, y0, w, h);
      if (filled) ctx.fill();
      ctx.stroke();
      break;
    case 'square': {
      const side = Math.max(Math.abs(w), Math.abs(h));
      const sx = w < 0 ? -side : side;
      const sy = h < 0 ? -side : side;
      ctx.beginPath(); ctx.rect(x0, y0, sx, sy);
      if (filled) ctx.fill();
      ctx.stroke();
      break;
    }
    case 'circle':
      ctx.beginPath(); ctx.arc(x0, y0, r, 0, 2 * Math.PI);
      if (filled) ctx.fill();
      ctx.stroke();
      break;
    case 'triangle':
      ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x0 + w / 2, y0); ctx.lineTo(x1, y1); ctx.closePath();
      if (filled) ctx.fill();
      ctx.stroke();
      break;
    case 'ellipse': {
      const cx = x0 + w / 2, cy = y0 + h / 2;
      ctx.beginPath(); ctx.ellipse(cx, cy, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, 2 * Math.PI);
      if (filled) ctx.fill();
      ctx.stroke();
      break;
    }
    case 'rtriangle': // right triangle (right angle at bottom-left)
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.lineTo(x1, y1); ctx.closePath();
      if (filled) ctx.fill();
      ctx.stroke();
      break;
    case 'diamond': {
      const cx = x0 + w / 2, cy = y0 + h / 2;
      ctx.beginPath();
      ctx.moveTo(cx, y0); ctx.lineTo(x1, cy); ctx.lineTo(cx, y1); ctx.lineTo(x0, cy); ctx.closePath();
      if (filled) ctx.fill();
      ctx.stroke();
      break;
    }
    case 'pentagon':
    case 'hexagon': {
      const sides = style.tool === 'pentagon' ? 5 : 6;
      const rad = r || 1;
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = -Math.PI / 2 + i * 2 * Math.PI / sides; // point up
        const px = x0 + Math.cos(a) * rad, py = y0 + Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      if (filled) ctx.fill();
      ctx.stroke();
      break;
    }
    case 'arrow': {
      const ang = Math.atan2(h, w);
      const head = Math.min(r * 0.3, 30) || 8;
      ctx.beginPath();
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      ctx.lineTo(x1 - head * Math.cos(ang - Math.PI / 6), y1 - head * Math.sin(ang - Math.PI / 6));
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 - head * Math.cos(ang + Math.PI / 6), y1 - head * Math.sin(ang + Math.PI / 6));
      ctx.stroke();
      break;
    }
    case 'cross': {
      const aw = Math.min(Math.abs(w), Math.abs(h)) / 3; // arm width
      const cx = x0 + w / 2, cy = y0 + h / 2;
      const lx = Math.min(x0, x1), rx = Math.max(x0, x1);
      const ty = Math.min(y0, y1), by = Math.max(y0, y1);
      ctx.beginPath();
      ctx.moveTo(cx - aw / 2, ty);
      ctx.lineTo(cx + aw / 2, ty);
      ctx.lineTo(cx + aw / 2, cy - aw / 2);
      ctx.lineTo(rx, cy - aw / 2);
      ctx.lineTo(rx, cy + aw / 2);
      ctx.lineTo(cx + aw / 2, cy + aw / 2);
      ctx.lineTo(cx + aw / 2, by);
      ctx.lineTo(cx - aw / 2, by);
      ctx.lineTo(cx - aw / 2, cy + aw / 2);
      ctx.lineTo(lx, cy + aw / 2);
      ctx.lineTo(lx, cy - aw / 2);
      ctx.lineTo(cx - aw / 2, cy - aw / 2);
      ctx.closePath();
      if (filled) ctx.fill();
      ctx.stroke();
      break;
    }
    case 'heart': {
      const hw = Math.abs(w) || 1, hh = Math.abs(h) || 1;
      const cx = x0, cy = y0;
      ctx.beginPath();
      ctx.moveTo(cx, cy + hh * 0.3);
      ctx.bezierCurveTo(cx, cy, cx - hw / 2, cy, cx - hw / 2, cy + hh * 0.3);
      ctx.bezierCurveTo(cx - hw / 2, cy + hh * 0.6, cx, cy + hh * 0.8, cx, cy + hh);
      ctx.bezierCurveTo(cx, cy + hh * 0.8, cx + hw / 2, cy + hh * 0.6, cx + hw / 2, cy + hh * 0.3);
      ctx.bezierCurveTo(cx + hw / 2, cy, cx, cy, cx, cy + hh * 0.3);
      ctx.closePath();
      if (filled) ctx.fill();
      ctx.stroke();
      break;
    }
    case 'star': { // 五角星
      const o = r || 1;
      starPath(ctx, x0, y0, 5, o, o / 2.5);
      if (filled) ctx.fill();
      ctx.stroke();
      break;
    }
    case 'star4': { // 四角星（尖銳）
      const o = r || 1;
      starPath(ctx, x0, y0, 4, o, o * 0.38);
      if (filled) ctx.fill();
      ctx.stroke();
      break;
    }
    case 'star6': { // 六角星
      const o = r || 1;
      starPath(ctx, x0, y0, 6, o, o * 0.55);
      if (filled) ctx.fill();
      ctx.stroke();
      break;
    }
    case 'burst': { // 星爆／閃耀（八角尖星）
      const o = r || 1;
      starPath(ctx, x0, y0, 8, o, o * 0.42);
      if (filled) ctx.fill();
      ctx.stroke();
      break;
    }
    case 'flower': { // 花（5 花瓣 + 花心）
      const s = r || 1; const cx = x0, cy = y0;
      const petals = 5, pr = s * 0.42, pd = s * 0.55;
      ctx.beginPath();
      for (let i = 0; i < petals; i++) {
        const a = -Math.PI / 2 + i * 2 * Math.PI / petals;
        const px = cx + Math.cos(a) * pd, py = cy + Math.sin(a) * pd;
        ctx.moveTo(px + pr, py); ctx.arc(px, py, pr, 0, 2 * Math.PI);
      }
      ctx.moveTo(cx + pr * 0.6, cy); ctx.arc(cx, cy, pr * 0.6, 0, 2 * Math.PI);
      if (filled) ctx.fill();
      ctx.stroke();
      break;
    }
    case 'teardrop': { // 水滴（尖端朝上）
      const s = r || 1; const cx = x0, cy = y0;
      ctx.beginPath();
      ctx.moveTo(cx, cy - s);
      ctx.bezierCurveTo(cx + s * 0.9, cy - s * 0.1, cx + s * 0.55, cy + s, cx, cy + s);
      ctx.bezierCurveTo(cx - s * 0.55, cy + s, cx - s * 0.9, cy - s * 0.1, cx, cy - s);
      ctx.closePath();
      if (filled) ctx.fill();
      ctx.stroke();
      break;
    }
    case 'spade': { // 黑桃 (centre x0,y0, size r)
      const s = r || 1; const cx = x0, cy = y0;
      ctx.beginPath();
      ctx.moveTo(cx, cy - s);
      ctx.bezierCurveTo(cx - s * 1.1, cy + s * 0.15, cx - s * 0.5, cy + s * 0.7, cx, cy + s * 0.45);
      ctx.bezierCurveTo(cx + s * 0.5, cy + s * 0.7, cx + s * 1.1, cy + s * 0.15, cx, cy - s);
      ctx.closePath();
      if (filled) ctx.fill();
      ctx.stroke();
      ctx.beginPath(); // stem
      ctx.moveTo(cx, cy + s * 0.3);
      ctx.lineTo(cx - s * 0.3, cy + s * 0.85);
      ctx.lineTo(cx + s * 0.3, cy + s * 0.85);
      ctx.closePath();
      if (filled) ctx.fill();
      ctx.stroke();
      break;
    }
    case 'club': { // 梅花
      const s = r || 1; const cx = x0, cy = y0; const rr = s * 0.42;
      ctx.beginPath();
      ctx.moveTo(cx + rr, cy - s * 0.35); ctx.arc(cx, cy - s * 0.35, rr, 0, 2 * Math.PI);
      ctx.moveTo(cx - s * 0.45 + rr, cy + s * 0.1); ctx.arc(cx - s * 0.45, cy + s * 0.1, rr, 0, 2 * Math.PI);
      ctx.moveTo(cx + s * 0.45 + rr, cy + s * 0.1); ctx.arc(cx + s * 0.45, cy + s * 0.1, rr, 0, 2 * Math.PI);
      if (filled) ctx.fill();
      ctx.stroke();
      ctx.beginPath(); // stem
      ctx.moveTo(cx, cy + s * 0.2);
      ctx.lineTo(cx - s * 0.24, cy + s * 0.8);
      ctx.lineTo(cx + s * 0.24, cy + s * 0.8);
      ctx.closePath();
      if (filled) ctx.fill();
      ctx.stroke();
      break;
    }
    case 'catpaw': { // 貓爪：大肉墊 + 4 趾
      const s = r || 1; const cx = x0, cy = y0; const pad = s * 0.6; const toeR = s * 0.22;
      ctx.beginPath();
      ctx.moveTo(cx + pad, cy + s * 0.25);
      ctx.ellipse(cx, cy + s * 0.25, pad, pad * 0.8, 0, 0, 2 * Math.PI);
      const toes: [number, number][] = [[-0.55, -0.35], [-0.2, -0.62], [0.2, -0.62], [0.55, -0.35]];
      for (const [dx, dy] of toes) {
        ctx.moveTo(cx + dx * s + toeR, cy + dy * s);
        ctx.ellipse(cx + dx * s, cy + dy * s, toeR, toeR, 0, 0, 2 * Math.PI);
      }
      if (filled) ctx.fill();
      ctx.stroke();
      break;
    }
    case 'moon': { // 月（新月）
      const s = r || 1; const cx = x0, cy = y0;
      ctx.beginPath();
      ctx.arc(cx, cy, s, -Math.PI / 2, Math.PI / 2, false);
      ctx.arc(cx + s * 0.5, cy, s * 0.85, Math.PI / 2, -Math.PI / 2, true);
      ctx.closePath();
      if (filled) ctx.fill();
      ctx.stroke();
      break;
    }
    case 'lightning': { // 閃電
      const s = r || 1; const cx = x0, cy = y0;
      ctx.beginPath();
      ctx.moveTo(cx + s * 0.2, cy - s);
      ctx.lineTo(cx - s * 0.4, cy + s * 0.1);
      ctx.lineTo(cx, cy + s * 0.1);
      ctx.lineTo(cx - s * 0.2, cy + s);
      ctx.lineTo(cx + s * 0.5, cy - s * 0.2);
      ctx.lineTo(cx + s * 0.05, cy - s * 0.2);
      ctx.closePath();
      if (filled) ctx.fill();
      ctx.stroke();
      break;
    }
  }
}

function hexToRGBA(hex: string, alpha = 1): [number, number, number, number] {
  const h = (hex || '#000000').replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16) || 0,
    parseInt(h.substring(2, 4), 16) || 0,
    parseInt(h.substring(4, 6), 16) || 0,
    Math.round(Math.min(1, Math.max(0, alpha)) * 255),
  ];
}

// Premultiplied-alpha read: two near-transparent pixels should compare as
// "the same" no matter what leftover RGB they happen to carry (very common
// after erasing, or on anti-aliased stroke edges) — comparing raw
// un-premultiplied RGBA let stray colour in transparent pixels register as a
// "different colour" and stop the flood early, which is what made fills look
// patchy/incomplete near stroke edges.
function premul(data: Uint8ClampedArray, i: number): [number, number, number, number] {
  const a = data[i + 3];
  const k = a / 255;
  return [data[i] * k, data[i + 1] * k, data[i + 2] * k, a];
}

// Paint bucket: fill the contiguous, similarly-coloured region at (sx,sy).
//
// Two passes:
//  1. The actual flood fill, using premultiplied-colour tolerance matching —
//     this decides how far the fill spreads, and no longer trips over stray
//     RGB baked into transparent pixels.
//  2. A 1px "rim" pass immediately around the filled region: pixels that sit
//     on a stroke's anti-aliased edge (partway between the target colour and
//     the line colour, so just outside the flood's tolerance) get the fill
//     colour blended in proportionally to how close they still are to the
//     target, instead of being left as a hard, jagged, half-filled border.
//     This never extends the flood itself — it only touches pixels already
//     touching a filled pixel — so it can't leak further through gaps in a
//     drawing; it just smooths the edge the flood already reached.
export function floodFill(ctx: CanvasRenderingContext2D, sx: number, sy: number, hex: string, alpha = 1) {
  sx = Math.floor(sx); sy = Math.floor(sy);
  if (sx < 0 || sy < 0 || sx >= BOARD_W || sy >= BOARD_H) return;
  const img = ctx.getImageData(0, 0, BOARD_W, BOARD_H);
  const data = img.data;
  const orig = data.slice(); // snapshot for the rim pass' blend-weight calc below
  const idx = (x: number, y: number) => (y * BOARD_W + x) * 4;
  const si = idx(sx, sy);
  const [tr, tg, tb, ta] = premul(orig, si);
  const [fr, fg, fb, fa] = hexToRGBA(hex, alpha);
  if (data[si] === fr && data[si + 1] === fg && data[si + 2] === fb && data[si + 3] === fa) return;

  const tol = 32;
  const dist = (i: number) => {
    const [r, g, b, a] = premul(orig, i);
    return Math.max(Math.abs(r - tr), Math.abs(g - tg), Math.abs(b - tb), Math.abs(a - ta));
  };

  const visited = new Uint8Array(BOARD_W * BOARD_H);
  const filled = new Uint8Array(BOARD_W * BOARD_H);
  const stack: number[] = [sx, sy];
  while (stack.length) {
    const y = stack.pop()!, x = stack.pop()!;
    const p = y * BOARD_W + x;
    if (visited[p]) continue;
    visited[p] = 1;
    const i = p * 4;
    if (dist(i) > tol) continue;
    data[i] = fr; data[i + 1] = fg; data[i + 2] = fb; data[i + 3] = fa;
    filled[p] = 1;
    if (x > 0) stack.push(x - 1, y);
    if (x < BOARD_W - 1) stack.push(x + 1, y);
    if (y > 0) stack.push(x, y - 1);
    if (y < BOARD_H - 1) stack.push(x, y + 1);
  }

  // Rim pass: blend the fill colour into unfilled pixels that border a
  // filled one, weighted by how close they are to the target colour (1 right
  // at the flood's tolerance cutoff, fading to 0 by rimTol). Pixels beyond
  // rimTol are left untouched — they're genuinely different content (e.g. the
  // stroke's own solid colour), not just an anti-aliased fringe.
  const rimTol = tol * 3;
  for (let y = 0; y < BOARD_H; y++) {
    for (let x = 0; x < BOARD_W; x++) {
      const p = y * BOARD_W + x;
      if (filled[p]) continue;
      const touchesFilled =
        (x > 0 && filled[p - 1]) || (x < BOARD_W - 1 && filled[p + 1]) ||
        (y > 0 && filled[p - BOARD_W]) || (y < BOARD_H - 1 && filled[p + BOARD_W]);
      if (!touchesFilled) continue;
      const i = p * 4;
      const d = dist(i);
      if (d > rimTol) continue;
      const w = Math.max(0, Math.min(1, 1 - (d - tol) / (rimTol - tol)));
      data[i] = orig[i] + (fr - orig[i]) * w;
      data[i + 1] = orig[i + 1] + (fg - orig[i + 1]) * w;
      data[i + 2] = orig[i + 2] + (fb - orig[i + 2]) * w;
      data[i + 3] = orig[i + 3] + (fa - orig[i + 3]) * w;
    }
  }

  ctx.putImageData(img, 0, 0);
}
