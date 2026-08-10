// Pointer (mouse/touch/pen) input handling for the board: pen/eraser
// strokes, shape preview drag, bucket fill, text placement, whole-drawing
// move-drag, and the stroke/priority slider drags. Delegates to selection.ts
// for the "選取" tool.

import type {ShapeStyle} from '../shapes';
import {drawShapePreview, floodFill} from '../shapes';
import {askText} from '@/core/prompts';
import {t} from '@/i18n/i18n';
import {STROKE_BAR_X, STROKE_Y, STROKE_BAR_W, STROKE_H, MPRIO_Y, MPRIO_BAR_X, MPRIO_BAR_W, MPRIO_H, BOARD_W, BOARD_H} from '../constants';
import {A, pushUndo} from './slots';
import {State} from './editorState';
import {toLocal, inBoardArea, getBoardScreenRect, updateStrokeFromPointerX, pointInRect} from './geometry';
import {updatePriorityFromPointerX, commitMaskPriority} from './maskToggle';
import {afterEdit} from './editing';
import {onSelectPointerDown, onSelectPointerMove, onSelectPointerUp} from './selection';

function canvasCoordsFromEvent(evt: MouseEvent) {
  const canvas = MainCanvas.canvas;
  const rect = canvas.getBoundingClientRect();
  return {cx: (evt.clientX - rect.left) * (canvas.width / rect.width), cy: (evt.clientY - rect.top) * (canvas.height / rect.height)};
}
function shapeStyle(): ShapeStyle {
  return {tool: State.tool, filled: State.filled, color: State.color, thickness: State.thickness};
}

export function onPointerDown(evt: PointerEvent) {
  if (!A) return;
  const {cx, cy} = canvasCoordsFromEvent(evt);
  if (pointInRect(cx, cy, STROKE_BAR_X, STROKE_Y, STROKE_BAR_W, STROKE_H)) {
    State.draggingStroke = true;
    updateStrokeFromPointerX(cx);
    return;
  }
  if (State.picker !== 'shape' && pointInRect(cx, cy, MPRIO_BAR_X, MPRIO_Y, MPRIO_BAR_W, MPRIO_H)) {
    State.draggingPriority = true;
    updatePriorityFromPointerX(cx);
    return;
  }
  if (!inBoardArea(cx, cy)) return;
  const local = toLocal(cx, cy);

  // Move mode: drag the whole drawing (offset), don't draw.
  if (State.tool === 'move') {
    State.dragging = true;
    State.dragStartCX = cx; State.dragStartCY = cy;
    State.dragStartOffsetX = A.offsetX; State.dragStartOffsetY = A.offsetY;
    return;
  }
  if (State.tool === 'select') { onSelectPointerDown(local); return; }
  if (State.tool === 'bucket') {
    pushUndo();
    A.ctx.globalCompositeOperation = 'source-over';
    floodFill(A.ctx, local[0], local[1], State.color);
    afterEdit();
    return;
  }
  if (State.tool === 'text') {
    const [lx, ly] = local;
    const slot = A;
    askText(t('free-draw-text-prompt'), State.lastText).then(text => {
      if (A !== slot || text == null || text === '') return;
      State.lastText = text;
      pushUndo();
      slot.ctx.globalCompositeOperation = 'source-over';
      const size = State.thickness * 5 + 10;
      slot.ctx.fillStyle = State.color;
      slot.ctx.textAlign = 'left';
      slot.ctx.textBaseline = 'middle';
      slot.ctx.font = `${size}px sans-serif`;
      slot.ctx.fillText(text, lx, ly);
      afterEdit();
    });
    return;
  }

  State.isPressing = true;
  State.startX = local[0];
  State.startY = local[1];
  pushUndo();
  if (State.tool === 'pen' || State.tool === 'eraser') {
    // No persistent path: each move below strokes only its own short segment
    // (see onPointerMove), so cost stays flat instead of growing with stroke
    // length. lastPoint/lastMid drive the midpoint-quadratic smoothing.
    State.lastPoint = local;
    State.lastMid = local;
  } else {
    State.snapshotBeforeShape = A.ctx.getImageData(0, 0, BOARD_W, BOARD_H);
  }
}

function strokeSegmentTo(local: [number, number]) {
  if (!A || !State.lastPoint || !State.lastMid) return;
  A.ctx.lineCap = 'round';
  A.ctx.lineJoin = 'round';
  A.ctx.lineWidth = State.thickness;
  if (State.tool === 'eraser') {
    A.ctx.globalCompositeOperation = 'destination-out';
    A.ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    A.ctx.globalCompositeOperation = 'source-over';
    A.ctx.strokeStyle = State.color;
  }
  // Classic smoothing: curve through the midpoint of each consecutive pair
  // of raw points, using the raw point itself as the control point. This
  // rounds off the faceted corners you'd otherwise get from sparse,
  // fast-moving mousemove/pointermove samples.
  const mid: [number, number] = [(State.lastPoint[0] + local[0]) / 2, (State.lastPoint[1] + local[1]) / 2];
  A.ctx.beginPath();
  A.ctx.moveTo(State.lastMid[0], State.lastMid[1]);
  A.ctx.quadraticCurveTo(State.lastPoint[0], State.lastPoint[1], mid[0], mid[1]);
  A.ctx.stroke();
  State.lastMid = mid;
  State.lastPoint = local;
}

export function onPointerMove(evt: PointerEvent) {
  if (!A) return;
  const {cx, cy} = canvasCoordsFromEvent(evt);
  if (State.draggingStroke) { updateStrokeFromPointerX(cx); return; }
  if (State.draggingPriority) { updatePriorityFromPointerX(cx); return; }
  if (State.dragging) {
    const r = getBoardScreenRect();
    A.offsetX = State.dragStartOffsetX + (cx - State.dragStartCX) * (500 / r.w);
    A.offsetY = State.dragStartOffsetY + (cy - State.dragStartCY) * (1000 / r.h);
    return;
  }
  if (State.tool === 'select') { onSelectPointerMove(toLocal(cx, cy)); return; }
  if (!State.isPressing) return;
  if (State.tool === 'pen' || State.tool === 'eraser') {
    // getCoalescedEvents() recovers the extra points the browser buffered
    // between animation frames during a fast stroke, instead of only ever
    // seeing the one point-per-frame the OS delivered to us — this is what
    // actually fixes "choppy/faceted at speed", pointer-events-only.
    const coalesced = typeof evt.getCoalescedEvents === 'function' ? evt.getCoalescedEvents() : [];
    const samples = coalesced.length ? coalesced : [evt];
    for (const sample of samples) {
      const p = canvasCoordsFromEvent(sample);
      strokeSegmentTo(toLocal(p.cx, p.cy));
    }
  } else {
    const local = toLocal(cx, cy);
    A.ctx.globalCompositeOperation = 'source-over';
    A.ctx.putImageData(State.snapshotBeforeShape!, 0, 0);
    drawShapePreview(A.ctx, shapeStyle(), State.startX, State.startY, local[0], local[1]);
  }
}

export function onPointerUp(evt: PointerEvent) {
  if (!A) return;
  if (State.draggingStroke) { State.draggingStroke = false; return; }
  if (State.draggingPriority) { State.draggingPriority = false; commitMaskPriority(); return; }
  if (State.dragging) { State.dragging = false; afterEdit(); return; }
  if (State.tool === 'select') { onSelectPointerUp(); return; }
  if (!State.isPressing) return;
  State.isPressing = false;
  if (State.tool === 'pen' || State.tool === 'eraser') {
    // Draw the final tiny segment up to the real last point (the curve above
    // always trails one point behind, at the midpoint). Must match the same
    // composite mode/style strokeSegmentTo() used mid-stroke — forcing
    // source-over here (as before) drew this last segment as an opaque black
    // dot instead of erasing, since the eraser's strokeStyle is a solid
    // 'rgba(0,0,0,1)' meant only for destination-out.
    if (State.lastMid && State.lastPoint) {
      A.ctx.globalCompositeOperation = State.tool === 'eraser' ? 'destination-out' : 'source-over';
      A.ctx.strokeStyle = State.tool === 'eraser' ? 'rgba(0,0,0,1)' : State.color;
      A.ctx.beginPath();
      A.ctx.moveTo(State.lastMid[0], State.lastMid[1]);
      A.ctx.lineTo(State.lastPoint[0], State.lastPoint[1]);
      A.ctx.stroke();
    }
    State.lastPoint = null;
    State.lastMid = null;
  } else {
    A.ctx.globalCompositeOperation = 'source-over';
    const {cx, cy} = canvasCoordsFromEvent(evt);
    const local = toLocal(cx, cy);
    A.ctx.putImageData(State.snapshotBeforeShape!, 0, 0);
    drawShapePreview(A.ctx, shapeStyle(), State.startX, State.startY, local[0], local[1]);
    State.snapshotBeforeShape = null;
  }
  afterEdit();
}

let listenersAttached = false;
export function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;
  // Pointer Events (not separate mouse+touch handlers) so mouse, touch, and
  // pen all go through the same code path, and so onPointerMove can call
  // evt.getCoalescedEvents() for smoother fast strokes (see strokeSegmentTo).
  MainCanvas.canvas.addEventListener('pointerdown', onPointerDown);
  MainCanvas.canvas.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
}
export function detachListeners() {
  if (!listenersAttached) return;
  listenersAttached = false;
  MainCanvas.canvas.removeEventListener('pointerdown', onPointerDown);
  MainCanvas.canvas.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
}
