// Shape drawing + flood fill for the free-draw board (board-local coordinates).

import {BOARD_W, BOARD_H} from './constants';

export const SHAPE_TOOLS = [
  'line', 'rect', 'square', 'circle', 'ellipse',
  'triangle', 'rtriangle', 'diamond', 'pentagon', 'hexagon',
  'arrow', 'cross', 'heart', 'star',
] as const;

export type ShapeTool = typeof SHAPE_TOOLS[number];

export const SHAPE_EMOJI: Record<string, string> = {
  line: '／', rect: '▭', square: '▢', circle: '◯', ellipse: '⬭',
  triangle: '△', rtriangle: '◺', diamond: '◇', pentagon: '⬠', hexagon: '⬡',
  arrow: '➜', cross: '✚', heart: '♡', star: '☆',
};

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
    case 'star': {
      const spikes = 5;
      const outerR = r || 1;
      const innerR = outerR / 2.5;
      let rot = Math.PI / 2 * 3;
      const cx = x0, cy = y0;
      const step = Math.PI / spikes;
      ctx.beginPath();
      ctx.moveTo(cx, cy - outerR);
      for (let i = 0; i < spikes; i++) {
        ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
        rot += step;
        ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
        rot += step;
      }
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
