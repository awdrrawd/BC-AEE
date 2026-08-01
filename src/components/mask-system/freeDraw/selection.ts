// Selection tool ("選取"): box-select + drag-move a region.
//
// Cutting straight into A.ctx while the piece is being dragged would force
// us to redraw the whole board every frame just to "un-cut" the previous
// position. Instead: on mouseup after the box-select, the region is copied
// to an offscreen buffer and cleared from the real canvas ONCE; while
// floating, the buffer is only ever composited on top during slotDraw() (a
// cheap drawImage, same cost as the existing live preview) and never
// touches A.ctx until commitSelection() bakes it in for real.

import type {Box} from './types';
import {BOARD_W, BOARD_H} from '../constants';
import {A, pushUndo} from './slots';
import {State, resetSelection} from './editorState';
import {afterEdit} from './editing';

function pointInFloatingSel(local: [number, number]): boolean {
  const r = State.selRect;
  if (!r) return false;
  const lx = local[0] - State.selOffsetX, ly = local[1] - State.selOffsetY;
  return lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h;
}

export function onSelectPointerDown(local: [number, number]) {
  if (!A) return;
  if (State.selPhase === 'floating') {
    if (pointInFloatingSel(local)) {
      State.selPhase = 'dragMove';
      State.selDragStartCX = local[0]; State.selDragStartCY = local[1];
      State.selDragStartOffX = State.selOffsetX; State.selDragStartOffY = State.selOffsetY;
      return;
    }
    commitSelection(); // clicked outside the floating piece: drop it here, start fresh
  }
  State.selPhase = 'dragSelect';
  State.selStart = local;
  State.selPreviewRect = {x: local[0], y: local[1], w: 0, h: 0};
}

export function onSelectPointerMove(local: [number, number]) {
  if (State.selPhase === 'dragSelect') {
    const [x0, y0] = State.selStart;
    State.selPreviewRect = {
      x: Math.min(x0, local[0]), y: Math.min(y0, local[1]),
      w: Math.abs(local[0] - x0), h: Math.abs(local[1] - y0),
    };
  } else if (State.selPhase === 'dragMove') {
    State.selOffsetX = State.selDragStartOffX + (local[0] - State.selDragStartCX);
    State.selOffsetY = State.selDragStartOffY + (local[1] - State.selDragStartCY);
  }
}

export function onSelectPointerUp() {
  if (!A) return;
  if (State.selPhase === 'dragSelect') {
    const r = State.selPreviewRect;
    State.selPreviewRect = null;
    if (!r || r.w < 4 || r.h < 4) { State.selPhase = 'idle'; return; } // too small to bother with
    const x = Math.max(0, Math.round(r.x)), y = Math.max(0, Math.round(r.y));
    const rect: Box = {
      x, y,
      w: Math.min(BOARD_W - x, Math.round(r.w)),
      h: Math.min(BOARD_H - y, Math.round(r.h)),
    };
    pushUndo();
    const buf = document.createElement('canvas');
    buf.width = rect.w; buf.height = rect.h;
    buf.getContext('2d')!.putImageData(A.ctx.getImageData(rect.x, rect.y, rect.w, rect.h), 0, 0);
    A.ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
    State.selRect = rect;
    State.selBuffer = buf;
    State.selOffsetX = 0; State.selOffsetY = 0;
    State.selPhase = 'floating';
  } else if (State.selPhase === 'dragMove') {
    State.selPhase = 'floating';
  }
}

// Bake the floating piece into the real canvas at wherever it currently sits.
export function commitSelection() {
  if (!A || State.selPhase !== 'floating' || !State.selBuffer || !State.selRect) return;
  const r = State.selRect;
  A.ctx.globalCompositeOperation = 'source-over';
  A.ctx.drawImage(State.selBuffer, r.x + State.selOffsetX, r.y + State.selOffsetY);
  resetSelection();
  afterEdit();
}
