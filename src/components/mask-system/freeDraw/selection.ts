// Floating pieces: box-select ("選取") + drag-move + corner-resize.
//
// Cutting straight into A.ctx while the piece is being dragged would force
// us to redraw the whole board every frame just to "un-cut" the previous
// position. Instead: on mouseup after the box-select, the region is copied
// to an offscreen buffer and cleared from the real canvas ONCE; while
// floating, the buffer is only ever composited on top during slotDraw() (a
// cheap drawImage, same cost as the existing live preview) and never
// touches A.ctx until commitSelection() bakes it in for real.
//
// An imported image (imageImport.ts) enters the same state via placeFloating()
// and is therefore handled by every path below — it is never a separate kind
// of object, and once committed it's just pixels on the board like any stroke.

import type {Box} from './types';
import {BOARD_W, BOARD_H, SEL_HANDLE} from '../constants';
import {A, pushUndo} from './slots';
import {State, resetSelection} from './editorState';
import {afterEdit} from './editing';

function pointInFloatingSel(local: [number, number]): boolean {
  const r = State.selRect;
  if (!r) return false;
  const lx = local[0] - State.selOffsetX, ly = local[1] - State.selOffsetY;
  return lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h;
}

// The resize grip at the piece's bottom-right corner, in board coords. Drawn by
// ui.ts and hit-tested here from the same function so the two can't drift apart.
export function selHandleRect(): Box | null {
  const r = State.selRect;
  if (!r || (State.selPhase !== 'floating' && State.selPhase !== 'dragScale')) return null;
  const cx = r.x + State.selOffsetX + r.w, cy = r.y + State.selOffsetY + r.h;
  return {x: cx - SEL_HANDLE / 2, y: cy - SEL_HANDLE / 2, w: SEL_HANDLE, h: SEL_HANDLE};
}

// Drop an arbitrary bitmap on the board as a floating piece, centred. Used by
// the image import; `w`/`h` are the DISPLAY size (buf keeps its own resolution).
// pushUndo runs while the board is still untouched, so one undo after the piece
// is baked in removes it again.
export function placeFloating(buf: HTMLCanvasElement, w: number, h: number) {
  if (!A) return;
  commitSelection(); // a piece already floating stays wherever the user put it
  pushUndo();
  State.selRect = {x: Math.round((BOARD_W - w) / 2), y: Math.round((BOARD_H - h) / 2), w, h};
  State.selBuffer = buf;
  State.selOffsetX = 0; State.selOffsetY = 0;
  State.selPhase = 'floating';
  State.tool = 'select'; // route pointer events through the handlers below
}

export function onSelectPointerDown(local: [number, number]) {
  if (!A) return;
  if (State.selPhase === 'floating') {
    const grip = selHandleRect();
    if (grip && local[0] >= grip.x && local[0] <= grip.x + grip.w && local[1] >= grip.y && local[1] <= grip.y + grip.h) {
      State.selPhase = 'dragScale';
      State.selDragStartCX = local[0]; State.selDragStartCY = local[1];
      State.selScaleStartW = State.selRect!.w; State.selScaleStartH = State.selRect!.h;
      return;
    }
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
  } else if (State.selPhase === 'dragScale' && State.selRect) {
    // Uniform scale: the horizontal drag drives the width and the height follows
    // the piece's starting aspect, so an imported picture can't be squashed.
    const aspect = State.selScaleStartH / (State.selScaleStartW || 1);
    const w = Math.max(8, State.selScaleStartW + (local[0] - State.selDragStartCX));
    State.selRect.w = w;
    State.selRect.h = Math.max(8, w * aspect);
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
  } else if (State.selPhase === 'dragMove' || State.selPhase === 'dragScale') {
    State.selPhase = 'floating';
  }
}

// Bake the floating piece into the real canvas at wherever it currently sits,
// at its current DISPLAY size — after this it's indistinguishable from anything
// drawn by hand: one canvas, one saved PNG.
export function commitSelection() {
  if (!A || State.selPhase !== 'floating' || !State.selBuffer || !State.selRect) return;
  const r = State.selRect;
  A.ctx.globalCompositeOperation = 'source-over';
  A.ctx.drawImage(State.selBuffer, r.x + State.selOffsetX, r.y + State.selOffsetY, r.w, r.h);
  resetSelection();
  afterEdit();
}
