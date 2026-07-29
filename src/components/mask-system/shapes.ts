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
}

export function drawShapePreview(
  ctx: CanvasRenderingContext2D,
  style: ShapeStyle,
  x0: number, y0: number, x1: number, y1: number,
) {
  ctx.lineWidth = style.thickness;
  ctx.strokeStyle = style.color;
  ctx.fillStyle = style.color;
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

function hexToRGBA(hex: string): [number, number, number, number] {
  const h = (hex || '#000000').replace('#', '');
  return [parseInt(h.substring(0, 2), 16) || 0, parseInt(h.substring(2, 4), 16) || 0, parseInt(h.substring(4, 6), 16) || 0, 255];
}

// Paint bucket: fill the contiguous, similarly-coloured region at (sx,sy).
export function floodFill(ctx: CanvasRenderingContext2D, sx: number, sy: number, hex: string) {
  sx = Math.floor(sx); sy = Math.floor(sy);
  if (sx < 0 || sy < 0 || sx >= BOARD_W || sy >= BOARD_H) return;
  const img = ctx.getImageData(0, 0, BOARD_W, BOARD_H);
  const data = img.data;
  const idx = (x: number, y: number) => (y * BOARD_W + x) * 4;
  const si = idx(sx, sy);
  const tr = data[si], tg = data[si + 1], tb = data[si + 2], ta = data[si + 3];
  const [fr, fg, fb, fa] = hexToRGBA(hex);
  if (tr === fr && tg === fg && tb === fb && ta === fa) return;
  const tol = 32;
  const match = (i: number) => Math.abs(data[i] - tr) <= tol && Math.abs(data[i + 1] - tg) <= tol &&
    Math.abs(data[i + 2] - tb) <= tol && Math.abs(data[i + 3] - ta) <= tol;
  const visited = new Uint8Array(BOARD_W * BOARD_H);
  const stack: number[] = [sx, sy];
  while (stack.length) {
    const y = stack.pop()!, x = stack.pop()!;
    const p = y * BOARD_W + x;
    if (visited[p]) continue;
    visited[p] = 1;
    const i = p * 4;
    if (!match(i)) continue;
    data[i] = fr; data[i + 1] = fg; data[i + 2] = fb; data[i + 3] = fa;
    if (x > 0) stack.push(x - 1, y);
    if (x < BOARD_W - 1) stack.push(x + 1, y);
    if (y > 0) stack.push(x, y - 1);
    if (y < BOARD_H - 1) stack.push(x, y + 1);
  }
  ctx.putImageData(img, 0, 0);
}
