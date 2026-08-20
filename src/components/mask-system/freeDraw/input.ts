// Pointer (mouse/touch/pen) input handling for the board: pen/eraser
// strokes, shape preview drag, bucket fill, text placement, whole-drawing
// move-drag, and the stroke/priority slider drags. Delegates to selection.ts
// for the "選取" tool.

import type {ShapeStyle} from '../shapes';
import {drawShapePreview, floodFill} from '../shapes';
import {askText} from '@/core/prompts';
import {t} from '@/i18n/i18n';
import {STROKE_BAR_X, STROKE_Y, STROKE_BAR_W, STROKE_H, MPRIO_Y, MPRIO_BAR_X, MPRIO_BAR_W, MPRIO_H, BOARD_W, BOARD_H} from '../constants';
import {A, pushUndo, scratch, scratchCtx} from './slots';
import {State} from './editorState';
import {toLocal, inBoardArea, getBoardScreenRect, updateStrokeFromPointerX, pointInRect} from './geometry';
import {updatePriorityFromPointerX, commitMaskPriority} from './maskToggle';
import {afterEdit} from './editing';
import {onSelectPointerDown, onSelectPointerMove, onSelectPointerUp} from './selection';
import {onPaste} from './imageImport';

function canvasCoordsFromEvent(evt: MouseEvent) {
  const canvas = MainCanvas.canvas;
  const rect = canvas.getBoundingClientRect();
  return {cx: (evt.clientX - rect.left) * (canvas.width / rect.width), cy: (evt.clientY - rect.top) * (canvas.height / rect.height)};
}
function shapeStyle(): ShapeStyle {
  return {tool: State.tool, filled: State.filled, color: State.color, thickness: State.thickness, shift: State.shift};
}

// Run `draw` once normally and, with symmetry on, once more mirrored about the
// board's vertical centre. Everything that takes board coords goes through here
// so the two passes can never drift apart.
function withSymmetry(ctx: CanvasRenderingContext2D, draw: () => void) {
  draw();
  if (!State.symmetry) return;
  ctx.save();
  ctx.translate(BOARD_W, 0);
  ctx.scale(-1, 1);
  draw();
  ctx.restore();
}

// Pen tablets report 0..1; mice report a fixed value, so only a real pen drives
// the width. A 0 reading (first sample of a stroke, or hardware that doesn't
// report pressure at all) means "unknown" → full width, never a vanishing line.
function pressureOf(evt: PointerEvent): number {
  if (evt.pointerType !== 'pen') return 1;
  return evt.pressure > 0 ? 0.25 + evt.pressure * 0.75 : 1;
}

export function onPointerDown(evt: PointerEvent) {
  if (!A || A.loading) return;
  State.shift = evt.shiftKey;
  const {cx, cy} = canvasCoordsFromEvent(evt);
  if (pointInRect(cx, cy, STROKE_BAR_X, STROKE_Y, STROKE_BAR_W, STROKE_H)) {
    State.draggingStroke = true;
    updateStrokeFromPointerX(cx);
    return;
  }
  if (State.picker !== 'shape' && pointInRect(cx, cy, MPRIO_BAR_X, MPRIO_Y, MPRIO_BAR_W, MPRIO_H)) {
    State.draggingPriority = true;
    State.priorityPreview = true;
    updatePriorityFromPointerX(cx);
    return;
  }
  if (!inBoardArea(cx, cy)) return;
  try { MainCanvas.canvas.setPointerCapture(evt.pointerId); } catch { /* unsupported/lost pointer */ }
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
    // The fill writes pixels directly (putImageData), which ignores globalAlpha
    // — the opacity has to go into the colour it writes instead.
    floodFill(A.ctx, local[0], local[1], State.color, State.alpha);
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
      slot.ctx.save();
      slot.ctx.globalCompositeOperation = 'source-over';
      slot.ctx.globalAlpha = State.alpha;
      const size = State.thickness * 5 + 10;
      slot.ctx.fillStyle = State.color;
      slot.ctx.textAlign = 'left';
      slot.ctx.textBaseline = 'middle';
      slot.ctx.font = `${size}px sans-serif`;
      slot.ctx.fillText(text, lx, ly); // no symmetry pass: mirrored text is just backwards
      slot.ctx.restore();
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
    scratchCtx.clearRect(0, 0, BOARD_W, BOARD_H); // fresh stroke layer
    // A click/tap without movement is still a real stroke. Explicitly paint
    // its round cap; a zero-length canvas path is not rendered consistently.
    const radius = Math.max(0.25, State.thickness * pressureOf(evt) / 2);
    scratchCtx.fillStyle = State.tool === 'eraser' ? '#000000' : State.color;
    withSymmetry(scratchCtx, () => {
      scratchCtx.beginPath();
      scratchCtx.arc(local[0], local[1], radius, 0, Math.PI * 2);
      scratchCtx.fill();
    });
  } else {
    State.snapshotBeforeShape = A.ctx.getImageData(0, 0, BOARD_W, BOARD_H);
  }
}

// Strokes go onto the scratch layer at FULL opacity; commitStroke() composites
// the finished shape onto the board once, applying State.alpha there. The eraser
// paints the scratch solid too — it only becomes a cut-out at composite time.
function strokeSegmentTo(local: [number, number], pressure: number) {
  if (!A || !State.lastPoint || !State.lastMid) return;
  const ctx = scratchCtx;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(0.5, State.thickness * pressure);
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = State.tool === 'eraser' ? '#000000' : State.color;
  // Classic smoothing: curve through the midpoint of each consecutive pair
  // of raw points, using the raw point itself as the control point. This
  // rounds off the faceted corners you'd otherwise get from sparse,
  // fast-moving mousemove/pointermove samples.
  const from = State.lastMid, ctrl = State.lastPoint;
  const mid: [number, number] = [(ctrl[0] + local[0]) / 2, (ctrl[1] + local[1]) / 2];
  withSymmetry(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    ctx.quadraticCurveTo(ctrl[0], ctrl[1], mid[0], mid[1]);
    ctx.stroke();
  });
  State.lastMid = mid;
  State.lastPoint = local;
}

// Merge the finished stroke into the board: source-over for the pen, and
// destination-out for the eraser so State.alpha reads as erase STRENGTH.
function commitStroke() {
  if (!A) return;
  A.ctx.save();
  A.ctx.globalAlpha = State.alpha;
  A.ctx.globalCompositeOperation = State.tool === 'eraser' ? 'destination-out' : 'source-over';
  A.ctx.drawImage(scratch, 0, 0);
  A.ctx.restore();
  scratchCtx.clearRect(0, 0, BOARD_W, BOARD_H);
}

// True while a pen/eraser stroke is still only on the scratch layer, so the
// editor preview knows to composite it on top of the board (see ui.ts).
export function strokeInProgress(): boolean {
  return State.isPressing && (State.tool === 'pen' || State.tool === 'eraser');
}

export function onPointerMove(evt: PointerEvent) {
  if (!A || A.loading) return;
  State.shift = evt.shiftKey;
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
      strokeSegmentTo(toLocal(p.cx, p.cy), pressureOf(sample));
    }
  } else {
    const local = toLocal(cx, cy);
    A.ctx.globalCompositeOperation = 'source-over';
    A.ctx.putImageData(State.snapshotBeforeShape!, 0, 0);
    drawShape(local);
  }
}

// Shapes redraw from the pre-drag snapshot each frame, so they can be painted
// straight onto the board with globalAlpha — there's no accumulation to bead.
function drawShape(local: [number, number]) {
  if (!A) return;
  const ctx = A.ctx;
  ctx.save();
  ctx.globalAlpha = State.alpha;
  withSymmetry(ctx, () => drawShapePreview(ctx, shapeStyle(), State.startX, State.startY, local[0], local[1]));
  ctx.restore();
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
    // always trails one point behind, at the midpoint) onto the scratch layer,
    // in the same style strokeSegmentTo() used, then merge the whole stroke.
    if (State.lastMid && State.lastPoint) {
      const from = State.lastMid, to = State.lastPoint;
      scratchCtx.globalCompositeOperation = 'source-over';
      scratchCtx.strokeStyle = State.tool === 'eraser' ? '#000000' : State.color;
      withSymmetry(scratchCtx, () => {
        scratchCtx.beginPath();
        scratchCtx.moveTo(from[0], from[1]);
        scratchCtx.lineTo(to[0], to[1]);
        scratchCtx.stroke();
      });
    }
    commitStroke();
    State.lastPoint = null;
    State.lastMid = null;
  } else {
    A.ctx.globalCompositeOperation = 'source-over';
    const {cx, cy} = canvasCoordsFromEvent(evt);
    const local = toLocal(cx, cy);
    A.ctx.putImageData(State.snapshotBeforeShape!, 0, 0);
    drawShape(local);
    State.snapshotBeforeShape = null;
  }
  afterEdit();
  try { MainCanvas.canvas.releasePointerCapture(evt.pointerId); } catch { /* already released */ }
}

function cancelPointerInteraction(evt: PointerEvent) {
  if (!A) return;
  scratchCtx.clearRect(0, 0, BOARD_W, BOARD_H);
  State.isPressing = false;
  State.dragging = false;
  State.draggingStroke = false;
  if (State.draggingPriority) {
    State.draggingPriority = false;
    commitMaskPriority();
  }
  State.snapshotBeforeShape = null;
  State.lastPoint = null;
  State.lastMid = null;
  evt.preventDefault();
}

let listenersAttached = false;
export function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;
  MainCanvas.canvas.style.touchAction = 'none';
  // Pointer Events (not separate mouse+touch handlers) so mouse, touch, and
  // pen all go through the same code path, and so onPointerMove can call
  // evt.getCoalescedEvents() for smoother fast strokes (see strokeSegmentTo).
  MainCanvas.canvas.addEventListener('pointerdown', onPointerDown);
  MainCanvas.canvas.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', cancelPointerInteraction);
  window.addEventListener('paste', onPaste); // Ctrl+V an image onto the board
}
export function detachListeners() {
  if (!listenersAttached) return;
  listenersAttached = false;
  MainCanvas.canvas.removeEventListener('pointerdown', onPointerDown);
  MainCanvas.canvas.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', cancelPointerInteraction);
  window.removeEventListener('paste', onPaste);
  scratchCtx.clearRect(0, 0, BOARD_W, BOARD_H);
  State.isPressing = false;
  State.dragging = false;
  State.draggingStroke = false;
  State.draggingPriority = false;
  State.snapshotBeforeShape = null;
  State.lastPoint = null;
  State.lastMid = null;
}
