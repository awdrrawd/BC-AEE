// Editor-wide UI state: current tool, color, thickness, and the selection
// tool's in-progress box-select / floating-piece state. A single shared
// object (not per-slot) — it resets to sane defaults on slotLoad.

import type {Box} from './types';

export const State = {
  tool: 'pen', // pen | eraser | bucket | text | move | select | <shape>
  picker: null as null | 'shape',
  filled: false,
  thickness: 4,
  color: '#A020F0', // default purple
  // 0–1, taken from the AEE colour picker's own opacity slider. For pen/eraser
  // it's applied when the finished stroke is composited off the scratch layer
  // (see slots.ts), so partial opacity never beads at the segment joins; the
  // eraser reads it as erase STRENGTH, giving a soft eraser for free.
  alpha: 1,
  // Mirror every pen/eraser stroke and shape about the board's vertical centre
  // — the usual way to paint symmetric body art. Text and bucket opt out (a
  // mirrored glyph is just backwards, and a flood fill has no path to mirror).
  symmetry: false,
  shift: false, // held during a shape drag → 45° line / square / circle
  isPressing: false,
  startX: 0, startY: 0,
  snapshotBeforeShape: null as ImageData | null,
  lastText: '',
  draggingStroke: false,
  draggingPriority: false,
  dragging: false,
  dragStartCX: 0, dragStartCY: 0, dragStartOffsetX: 0, dragStartOffsetY: 0,
  // Pen/eraser stroke smoothing: quadratic curve through consecutive
  // midpoints instead of straight lineTo segments, and each move only
  // (re)draws the new tiny segment rather than the whole accumulated path.
  lastPoint: null as [number, number] | null,
  lastMid: null as [number, number] | null,
  // Selection tool ("選取"): box-select a region, then drag it to a new spot
  // instead of erasing and redrawing. selRect/selBuffer hold the cut-out
  // piece; it floats on top of the board (never touching A.ctx) until
  // committed (baked into the real canvas) or discarded.
  // An imported image is the SAME thing (see imageImport.ts) — it just arrives
  // in selBuffer instead of being cut out of the board, so it inherits the drag,
  // resize and commit behaviour for free.
  selPhase: 'idle' as 'idle' | 'dragSelect' | 'floating' | 'dragMove' | 'dragScale',
  selStart: [0, 0] as [number, number],
  selPreviewRect: null as Box | null,
  // selRect is the piece's DISPLAY box; selBuffer keeps its own (possibly
  // higher) pixel resolution, so resizing re-samples from the source rather
  // than from whatever it was last shown at.
  selRect: null as Box | null,
  selBuffer: null as HTMLCanvasElement | null,
  selOffsetX: 0, selOffsetY: 0,
  selDragStartCX: 0, selDragStartCY: 0, selDragStartOffX: 0, selDragStartOffY: 0,
  selScaleStartW: 0, selScaleStartH: 0,
};

// Drop the floating piece without drawing it back (used when discarding edits).
export function resetSelection() {
  State.selPhase = 'idle';
  State.selRect = null;
  State.selBuffer = null;
  State.selOffsetX = 0; State.selOffsetY = 0;
  State.selPreviewRect = null;
}
