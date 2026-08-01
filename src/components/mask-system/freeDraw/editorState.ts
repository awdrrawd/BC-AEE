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
  selPhase: 'idle' as 'idle' | 'dragSelect' | 'floating' | 'dragMove',
  selStart: [0, 0] as [number, number],
  selPreviewRect: null as Box | null,
  selRect: null as Box | null,
  selBuffer: null as HTMLCanvasElement | null,
  selOffsetX: 0, selOffsetY: 0,
  selDragStartCX: 0, selDragStartCY: 0, selDragStartOffX: 0, selDragStartOffY: 0,
};

// Drop the floating piece without drawing it back (used when discarding edits).
export function resetSelection() {
  State.selPhase = 'idle';
  State.selRect = null;
  State.selBuffer = null;
  State.selOffsetX = 0; State.selOffsetY = 0;
  State.selPreviewRect = null;
}
