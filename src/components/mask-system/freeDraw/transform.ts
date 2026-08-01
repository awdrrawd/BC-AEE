// Transform (self-contained; baked into the drawing pixels). Move is just an
// offset (see slots/geometry); rotate/scale/mirror actually redraw the board
// canvas.

import {BOARD_W, BOARD_H} from '../constants';
import {A, pushUndo} from './slots';
import {afterEdit} from './editing';

export function applyTransform(rotateDeg: number, scaleDelta: number) {
  if (!A) return;
  pushUndo();
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  const oldScale = A.scale;
  const newScale = clamp(oldScale + scaleDelta, 0.2, 3);
  const relativeScale = newScale / oldScale;
  A.scale = newScale;
  A.rotation = (((A.rotation + rotateDeg) % 360) + 360) % 360;

  const snapshot = A.ctx.getImageData(0, 0, BOARD_W, BOARD_H);
  const tmp = document.createElement('canvas');
  tmp.width = BOARD_W; tmp.height = BOARD_H;
  tmp.getContext('2d')!.putImageData(snapshot, 0, 0);
  A.ctx.clearRect(0, 0, BOARD_W, BOARD_H);
  A.ctx.save();
  A.ctx.translate(BOARD_W / 2, BOARD_H / 2);
  A.ctx.rotate(rotateDeg * Math.PI / 180);
  A.ctx.scale(relativeScale, relativeScale);
  A.ctx.drawImage(tmp, -BOARD_W / 2, -BOARD_H / 2);
  A.ctx.restore();
  afterEdit();
}

export function flipCanvas(axis: 'x' | 'y') {
  if (!A) return;
  pushUndo();
  const snapshot = A.ctx.getImageData(0, 0, BOARD_W, BOARD_H);
  const tmp = document.createElement('canvas');
  tmp.width = BOARD_W; tmp.height = BOARD_H;
  tmp.getContext('2d')!.putImageData(snapshot, 0, 0);
  A.ctx.clearRect(0, 0, BOARD_W, BOARD_H);
  A.ctx.save();
  A.ctx.translate(axis === 'x' ? BOARD_W : 0, axis === 'y' ? BOARD_H : 0);
  A.ctx.scale(axis === 'x' ? -1 : 1, axis === 'y' ? -1 : 1);
  A.ctx.drawImage(tmp, 0, 0);
  A.ctx.restore();
  afterEdit();
}

export function moveBy(dx: number, dy: number) {
  if (!A) return;
  A.offsetX += dx; A.offsetY += dy;
  afterEdit();
}
