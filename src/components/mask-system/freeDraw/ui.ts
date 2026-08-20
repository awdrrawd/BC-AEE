// Toolbar rendering + click routing for the free-draw editor screen: the
// live board preview, row 1/2 icon buttons, stroke + mask-priority sliders,
// the shape picker, and the transform panel.

import type {Box} from './types';
import {
  ICON_W, ICON_H, TOOLBAR_Y1, TOOLBAR_Y2,
  STROKE_Y, STROKE_H, STROKE_LABEL_X, STROKE_LABEL_W, STROKE_BAR_X, STROKE_BAR_W,
  STROKE_FRAME_X, STROKE_FRAME_W, STROKE_MIN, STROKE_MAX,
  MPRIO_Y, MPRIO_H, MPRIO_FRAME_X, MPRIO_FRAME_W, MPRIO_LABEL_X, MPRIO_LABEL_W,
  MPRIO_BAR_X, MPRIO_BAR_W, MPRIO_MIN, MPRIO_MAX,
  BOUNDS_X, BOUNDS_Y, BOUNDS_W, BOUNDS_H,
  PICKER_X, PICKER_Y, PICKER_W,
  MOVE_STEP, ROTATE_STEP, SCALE_STEP,
  EXIT_ICON_X, ACCEPT_ICON_X, TOOLBAR_CANCEL_X, TOOLBAR_CLEAR_X, TOOLBAR_UNDO_X, TOOLBAR_REDO_X,
  MASK_X, IMAGE_X, SYMMETRY_X,
  TOOL_COLOR_X, TOOL_ERASER_X, TOOL_BUCKET_X, TOOL_TEXT_X, TOOL_SHAPE_X, TOOL_FILL_X, TOOL_PEN_X, TOOL_SELECT_X,
  DRAW_GROUPS, BOARD_W, BOARD_H,
  APPEARANCE_SIZE_FRAME_X, APPEARANCE_SIZE_FRAME_W, APPEARANCE_SIZE_Y, APPEARANCE_SIZE_H,
  APPEARANCE_SIZE_LABEL_X, APPEARANCE_SIZE_LABEL_W, APPEARANCE_SIZE_VALUE_X, APPEARANCE_SIZE_VALUE_W,
} from '../constants';
import {SHAPE_TOOLS, SHAPE_EMOJI} from '../shapes';
import {ICON} from '../icons';
import {t} from '@/i18n/i18n';
import {openColorPicker as openAeeColorPicker} from '@/controllers/uiController';
import {runtime} from '@/core/runtime';
import {A, undo, redo, clearBoard, scratch, preview, previewCtx} from './slots';
import {strokeInProgress} from './input';
import {State} from './editorState';
import {getBoardScreenRect, getBoardViewportRect, getPickerLayout, getPickerItemRect, updateStrokeFromPointerX, colorForFill, contrastColor, inBoardArea} from './geometry';
import {toggleSlotMask} from './maskToggle';
import {applyTransform, flipCanvas, moveBy} from './transform';
import {applyToCharacter, leaveEditor, cancelEditingAndExit} from './lifecycle';
import {commitSelection, selHandleRect} from './selection';
import {importImage} from './imageImport';
import {afterEdit} from './editing';
import {targetAppearanceUsage, formatBytesK} from './appearanceSize';

// Transform panel layout (from the user's DDT layout): four mode headers with
// grouped controls beneath each.
const E2 = {
  moveHdr: {x: 1485, y: 290, w: 90, h: 90}, rotHdr: {x: 1585, y: 290, w: 90, h: 90},
  scaleHdr: {x: 1685, y: 290, w: 90, h: 90}, mirrorHdr: {x: 1785, y: 290, w: 90, h: 90},
  up: {x: 1485, y: 390, w: 40, h: 40}, down: {x: 1535, y: 390, w: 40, h: 40},
  left: {x: 1485, y: 440, w: 40, h: 40}, right: {x: 1535, y: 440, w: 40, h: 40},
  rotL: {x: 1585, y: 390, w: 40, h: 40}, rotR: {x: 1635, y: 390, w: 40, h: 40},
  scUp: {x: 1685, y: 390, w: 40, h: 40}, scDn: {x: 1735, y: 390, w: 40, h: 40},
  fH: {x: 1785, y: 390, w: 40, h: 40}, fV: {x: 1835, y: 390, w: 40, h: 40},
} as const;
const drawBox = (b: Box, text: string, bg: string, hover?: string) => DrawButton(b.x, b.y, b.w, b.h, text, bg, undefined, hover);
const hitBox = (b: Box) => MouseIn(b.x, b.y, b.w, b.h);

// AEE's own colour picker (live-updates State.color). It already carries an
// opacity slider and an eyedropper, so both come along for free — we just have
// to keep the opacity. The alpha reaches us through runtime.colorPickerAlpha,
// which is refreshed immediately before every live callback (uiController), so
// unlike the panel's own state it is never stale during a preview drag.
function openColorPicker() {
  openAeeColorPicker(State.color, (hex) => {
    if (!hex) return;
    State.color = hex;
    State.alpha = runtime.colorPickerAlpha / 255;
  }, false, Math.round(State.alpha * 100));
}

const ICON_INSET = 15;
function drawIconBtn(x: number, y: number, w: number, h: number, bgColor: string, iconSrc: string, hover: string) {
  DrawButton(x, y, w, h, '', bgColor, undefined, hover);
  if (iconSrc) DrawImageResize(iconSrc, x + ICON_INSET, y + ICON_INSET, w - ICON_INSET * 2, h - ICON_INSET * 2);
}

// Draws whatever the selection tool is currently doing on top of the live
// board preview. Never touches A.ctx — purely a screen-space overlay, so it's
// as cheap as the existing live-preview drawImage() above it.
function drawSelectionOverlay(rect: {x: number; y: number; w: number; h: number}, contentAlpha: number) {
  const toScreen = (b: Box) => ({
    x: rect.x + b.x * (rect.w / BOARD_W), y: rect.y + b.y * (rect.h / BOARD_H),
    w: b.w * (rect.w / BOARD_W), h: b.h * (rect.h / BOARD_H),
  });
  // Render the floating piece both while it's just sitting there ('floating')
  // and while it's actively being dragged ('dragMove') — these used to be
  // treated as the same visual state, but dragMove is set the instant a drag
  // starts and only flips back to 'floating' on pointerup. Since this function
  // only checked for 'floating', the piece was never drawn during the actual
  // drag — the cut-out region just sat empty (showing whatever's behind it)
  // until release, which looked like the piece fading out mid-drag and
  // snapping back solid on release.
  // 'dragScale' belongs here for the same reason as 'dragMove': it's set for the
  // whole duration of the drag, so leaving it out blanks the piece until release.
  if ((State.selPhase === 'floating' || State.selPhase === 'dragMove' || State.selPhase === 'dragScale') && State.selBuffer && State.selRect) {
    const b: Box = {...State.selRect, x: State.selRect.x + State.selOffsetX, y: State.selRect.y + State.selOffsetY};
    const s = toScreen(b);
    // Defensive: force full opacity/normal blending regardless of whatever
    // state the shared MainCanvas context was left in by other draw calls.
    MainCanvas.save();
    MainCanvas.globalAlpha = contentAlpha;
    MainCanvas.globalCompositeOperation = 'source-over';
    MainCanvas.drawImage(State.selBuffer, s.x, s.y, s.w, s.h);
    MainCanvas.globalAlpha = 1;
    MainCanvas.setLineDash([6, 4]);
    MainCanvas.strokeStyle = '#00BFFF';
    MainCanvas.lineWidth = 2;
    MainCanvas.strokeRect(s.x, s.y, s.w, s.h);
    const grip = selHandleRect();
    if (grip) {
      const g = toScreen(grip);
      MainCanvas.setLineDash([]);
      MainCanvas.fillStyle = '#00BFFF';
      MainCanvas.fillRect(g.x, g.y, g.w, g.h);
      MainCanvas.strokeStyle = 'white';
      MainCanvas.strokeRect(g.x, g.y, g.w, g.h);
    }
    MainCanvas.restore();
  } else if (State.selPhase === 'dragSelect' && State.selPreviewRect) {
    const s = toScreen(State.selPreviewRect);
    MainCanvas.save();
    MainCanvas.setLineDash([6, 4]);
    MainCanvas.strokeStyle = '#00BFFF';
    MainCanvas.lineWidth = 2;
    MainCanvas.strokeRect(s.x, s.y, s.w, s.h);
    MainCanvas.restore();
  }
}

export function slotDraw() {
  if (!A) return;
  const active = A;
  const rect = getBoardScreenRect();
  const contentAlpha = active.isMask ? 0.4 : 1;
  MainCanvas.save();
  MainCanvas.globalAlpha = contentAlpha;
  MainCanvas.globalCompositeOperation = 'source-over';
  // A stroke in flight lives on the scratch layer until release, so the preview
  // has to show board+scratch merged exactly as commitStroke() will merge them —
  // otherwise a reduced-opacity stroke looks like nothing is happening until you
  // let go. Merged offscreen: see the `preview` canvas in slots.ts.
  if (State.priorityPreview && !active.isMask) {
    // CharacterLoadCanvas is showing the live slot through the sorted Vis
    // layer. Drawing it here too would put it above every item again.
  } else if (strokeInProgress()) {
    previewCtx.globalCompositeOperation = 'source-over';
    previewCtx.globalAlpha = 1;
    previewCtx.clearRect(0, 0, BOARD_W, BOARD_H);
    previewCtx.drawImage(active.canvas, 0, 0);
    previewCtx.globalAlpha = State.alpha;
    previewCtx.globalCompositeOperation = State.tool === 'eraser' ? 'destination-out' : 'source-over';
    previewCtx.drawImage(scratch, 0, 0);
    MainCanvas.drawImage(preview, rect.x, rect.y, rect.w, rect.h);
  } else {
    MainCanvas.drawImage(active.canvas, rect.x, rect.y, rect.w, rect.h); // live preview
  }
  MainCanvas.restore();
  drawSelectionOverlay(rect, contentAlpha);
  if (State.showBounds) {
    const bounds = getBoardViewportRect();
    MainCanvas.save();
    MainCanvas.setLineDash([10, 6]);
    MainCanvas.lineWidth = 3;
    MainCanvas.strokeStyle = '#00BFFF';
    MainCanvas.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    MainCanvas.restore();
  }

  // Row 1
  DrawButton(MASK_X, TOOLBAR_Y1, ICON_W, ICON_H, '', active.isMask ? '#4CAF50' : 'White', 'Icons/Private.png', t('free-draw-mask-tooltip'));
  drawIconBtn(TOOLBAR_UNDO_X, TOOLBAR_Y1, ICON_W, ICON_H, 'White', ICON.undo, t('free-draw-undo-tooltip'));
  drawIconBtn(TOOLBAR_REDO_X, TOOLBAR_Y1, ICON_W, ICON_H, active.redoStack.length ? 'White' : '#DDDDDD', ICON.redo, t('free-draw-redo-tooltip'));
  DrawButton(TOOLBAR_CLEAR_X, TOOLBAR_Y1, ICON_W, ICON_H, '', 'White', 'Icons/Trash.png', t('free-draw-clear-tooltip'));
  DrawButton(TOOLBAR_CANCEL_X, TOOLBAR_Y1, ICON_W, ICON_H, '', 'White', 'Icons/Cancel.png', t('free-draw-cancel-tooltip'));
  drawIconBtn(IMAGE_X, TOOLBAR_Y1, ICON_W, ICON_H, 'White', ICON.image, t('free-draw-image-tooltip'));
  drawIconBtn(SYMMETRY_X, TOOLBAR_Y1, ICON_W, ICON_H, State.symmetry ? 'cyan' : 'White', ICON.symmetry, t('free-draw-symmetry-tooltip'));

  // Row 2
  drawIconBtn(TOOL_PEN_X, TOOLBAR_Y2, ICON_W, ICON_H, State.tool === 'pen' ? 'cyan' : 'White', ICON.pen, t('free-draw-pen-tooltip'));
  drawIconBtn(TOOL_FILL_X, TOOLBAR_Y2, ICON_W, ICON_H, State.filled ? 'cyan' : 'White', State.filled ? ICON.fillSolid : ICON.fillOutline, State.filled ? t('free-draw-fill-solid-tooltip') : t('free-draw-fill-outline-tooltip'));
  DrawButton(TOOL_SHAPE_X, TOOLBAR_Y2, ICON_W, ICON_H, (SHAPE_EMOJI[State.tool] || '△'), State.picker === 'shape' || (SHAPE_TOOLS as readonly string[]).includes(State.tool) ? 'cyan' : 'White', undefined, t('free-draw-shape-tooltip'));
  drawIconBtn(TOOL_TEXT_X, TOOLBAR_Y2, ICON_W, ICON_H, State.tool === 'text' ? 'cyan' : 'White', ICON.text, t('free-draw-text-tooltip'));
  drawIconBtn(TOOL_BUCKET_X, TOOLBAR_Y2, ICON_W, ICON_H, State.tool === 'bucket' ? 'cyan' : 'White', ICON.bucket, t('free-draw-bucket-tooltip'));
  drawIconBtn(TOOL_ERASER_X, TOOLBAR_Y2, ICON_W, ICON_H, State.tool === 'eraser' ? 'cyan' : 'White', ICON.eraser, t('free-draw-eraser-tooltip'));
  drawIconBtn(TOOL_COLOR_X, TOOLBAR_Y2, ICON_W, ICON_H, colorForFill(State.color, State.alpha), ICON.color, t('free-draw-color-tooltip'));
  drawIconBtn(TOOL_SELECT_X, TOOLBAR_Y2, ICON_W, ICON_H, State.tool === 'select' ? 'cyan' : 'White', ICON.select, t('free-draw-select-tooltip'));

  // Row 3: stroke slider
  DrawRect(STROKE_FRAME_X, STROKE_Y, STROKE_FRAME_W, STROKE_H, 'White');
  DrawEmptyRect(STROKE_FRAME_X, STROKE_Y, STROKE_FRAME_W, STROKE_H, 'Black', 2);
  DrawText(t('free-draw-stroke-label'), STROKE_LABEL_X + STROKE_LABEL_W / 2, STROKE_Y + STROKE_H / 2, 'black');
  DrawButton(STROKE_BAR_X, STROKE_Y, STROKE_BAR_W, STROKE_H, '', 'White', undefined, t('free-draw-stroke-tooltip'));
  const pct = (State.thickness - STROKE_MIN) / (STROKE_MAX - STROKE_MIN);
  MainCanvas.fillStyle = 'black';
  MainCanvas.fillRect(STROKE_BAR_X + 4, STROKE_Y + 4, (STROKE_BAR_W - 8) * pct, STROKE_H - 8);
  DrawText(`${State.thickness}px`, STROKE_BAR_X + STROKE_BAR_W / 2, STROKE_Y + STROKE_H / 2, 'black');

  if (State.picker === 'shape') {
    const layout = getPickerLayout(SHAPE_TOOLS.length);
    DrawRect(PICKER_X, PICKER_Y, PICKER_W, layout.height, 'White');
    DrawEmptyRect(PICKER_X, PICKER_Y, PICKER_W, layout.height, 'Black', 2);
    SHAPE_TOOLS.forEach((item, idx) => {
      const r2 = getPickerItemRect(idx);
      DrawButton(r2.x, r2.y, r2.w, r2.h, SHAPE_EMOJI[item] || '❖', State.tool === item ? 'cyan' : 'White', undefined, item);
    });
  } else {
    // Transform panel: mode headers + grouped controls.
    drawBox(E2.moveHdr, t('free-draw-move'), State.tool === 'move' ? 'cyan' : 'White', t('free-draw-move-tooltip'));
    drawBox(E2.rotHdr, t('free-draw-rotate'), 'White');
    drawBox(E2.scaleHdr, t('free-draw-scale'), 'White');
    drawBox(E2.mirrorHdr, t('free-draw-mirror'), 'White');
    drawBox(E2.up, t('free-draw-up'), 'White'); drawBox(E2.down, t('free-draw-down'), 'White');
    drawBox(E2.left, t('free-draw-left'), 'White'); drawBox(E2.right, t('free-draw-right'), 'White');
    drawBox(E2.rotL, '↺', 'White'); drawBox(E2.rotR, '↻', 'White');
    drawBox(E2.scUp, '＋', 'White'); drawBox(E2.scDn, '－', 'White');
    drawBox(E2.fH, t('free-draw-flip-h'), 'White'); drawBox(E2.fV, t('free-draw-flip-v'), 'White');
  }

  // Layer-order slider (shown in both draw & mask modes; hidden only while the
  // shape picker is open). The value is remembered on the drawing and drives the
  // mask's OverridePriority when masking is on.
  if (State.picker !== 'shape') {
    DrawRect(MPRIO_FRAME_X, MPRIO_Y, MPRIO_FRAME_W, MPRIO_H, 'White');
    DrawEmptyRect(MPRIO_FRAME_X, MPRIO_Y, MPRIO_FRAME_W, MPRIO_H, 'Black', 2);
    DrawText(t('free-draw-priority-label'), MPRIO_LABEL_X + MPRIO_LABEL_W / 2, MPRIO_Y + MPRIO_H / 2, 'black');
    DrawButton(MPRIO_BAR_X, MPRIO_Y, MPRIO_BAR_W, MPRIO_H, '', 'White', undefined, t('free-draw-priority-tooltip'));
    const ppct = (active.maskPriority - MPRIO_MIN) / (MPRIO_MAX - MPRIO_MIN);
    MainCanvas.fillStyle = '#4CAF50';
    MainCanvas.fillRect(MPRIO_BAR_X + 4, MPRIO_Y + 4, (MPRIO_BAR_W - 8) * ppct, MPRIO_H - 8);
    DrawText(`${active.maskPriority}`, MPRIO_BAR_X + MPRIO_BAR_W / 2, MPRIO_Y + MPRIO_H / 2, 'black');
    DrawButton(BOUNDS_X, BOUNDS_Y, BOUNDS_W, BOUNDS_H, t('free-draw-bounds-label'), State.showBounds ? '#4CAF50' : 'White', undefined, t('free-draw-bounds-tooltip'));
  }

  if (State.draggingStroke) {
    const screenR = State.thickness * (rect.w / BOARD_W) / 2;
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    MainCanvas.save();
    MainCanvas.beginPath();
    MainCanvas.arc(cx, cy, Math.max(screenR, 1), 0, 2 * Math.PI);
    MainCanvas.fillStyle = colorForFill(State.color, State.alpha);
    MainCanvas.globalAlpha = 0.85;
    MainCanvas.fill();
    MainCanvas.globalAlpha = 1;
    MainCanvas.lineWidth = 2;
    MainCanvas.strokeStyle = contrastColor(State.color);
    MainCanvas.stroke();
    MainCanvas.restore();
    DrawText(`${State.thickness}px`, cx, cy - screenR - 22, contrastColor(State.color) === 'white' ? 'black' : 'white');
  }

  DrawButton(ACCEPT_ICON_X, TOOLBAR_Y1, ICON_W, ICON_H, '', 'White', 'Icons/Accept.png', t('free-draw-accept-tooltip'));
  DrawButton(EXIT_ICON_X, TOOLBAR_Y1, ICON_W, ICON_H, '', 'White', 'Icons/Exit.png', t('free-draw-exit-tooltip'));

  drawAppearanceSizeReadout();
}

// Bottom-right readout of the target character's live serialized Appearance
// size. Accept is blocked at the hard limit; this readout lets the player
// correct the drawing before trying to save. Always shown.
function drawAppearanceSizeReadout() {
  const {used, budget} = targetAppearanceUsage();
  const ratio = Math.min(1, used / budget);
  const danger = ratio >= 0.9;
  const color = danger ? '#f87171' : 'black';
  DrawRect(APPEARANCE_SIZE_FRAME_X, APPEARANCE_SIZE_Y, APPEARANCE_SIZE_FRAME_W, APPEARANCE_SIZE_H, 'White');
  DrawEmptyRect(APPEARANCE_SIZE_FRAME_X, APPEARANCE_SIZE_Y, APPEARANCE_SIZE_FRAME_W, APPEARANCE_SIZE_H, danger ? '#f87171' : 'Black', 2);
  MainCanvas.save();
  MainCanvas.font = CommonGetFont(30);
  DrawText(t('free-draw-size-title'), APPEARANCE_SIZE_LABEL_X + APPEARANCE_SIZE_LABEL_W / 2, APPEARANCE_SIZE_Y + 20, color);
  MainCanvas.restore();
  DrawButton(APPEARANCE_SIZE_VALUE_X, APPEARANCE_SIZE_Y, APPEARANCE_SIZE_VALUE_W, APPEARANCE_SIZE_H, '', 'White', undefined, t(danger ? 'free-draw-size-danger-tooltip' : 'free-draw-size-tooltip'));
  const barX = APPEARANCE_SIZE_VALUE_X + 5;
  const barY = APPEARANCE_SIZE_Y + APPEARANCE_SIZE_H - 11;
  const barW = APPEARANCE_SIZE_VALUE_W - 10;
  DrawRect(barX, barY, barW, 6, '#d4d4d8');
  DrawRect(barX, barY, barW * ratio, 6, danger ? '#ef4444' : '#4CAF50');
  MainCanvas.save();
  MainCanvas.font = CommonGetFont(22);
  DrawText(`${formatBytesK(used)} / ${formatBytesK(budget)}`, APPEARANCE_SIZE_VALUE_X + APPEARANCE_SIZE_VALUE_W / 2, APPEARANCE_SIZE_Y + 18, color);
  MainCanvas.restore();
}

export function slotClick() {
  if (!A) return;
  // BC fires this Click callback for every click on the item screen — including
  // the exact same click that just finished a box-select drag (pointerup already
  // ran onSelectPointerUp() and set selPhase to 'floating'). Committing here
  // unconditionally would immediately bake that floating piece back in place
  // before the user ever gets a chance to drag it, making the select tool look
  // like it does nothing after the marquee. Clicks inside the board are already
  // fully handled by the pointerdown/up handlers (pick up / drag / commit on
  // out-of-bounds click), so only force a commit here for clicks that land on
  // the toolbar/side-panel chrome outside the board — e.g. so pressing Undo or
  // switching tools doesn't act on a stale floating piece.
  if (!inBoardArea(MouseX, MouseY)) commitSelection();
  if (MouseIn(ACCEPT_ICON_X, TOOLBAR_Y1, ICON_W, ICON_H)) { if (applyToCharacter()) leaveEditor(); return; }
  if (MouseIn(EXIT_ICON_X, TOOLBAR_Y1, ICON_W, ICON_H)) { cancelEditingAndExit(); return; }

  if (MouseIn(MASK_X, TOOLBAR_Y1, ICON_W, ICON_H)) { toggleSlotMask(); return; }
  // Async (file dialog): the click that opens it is the user gesture the browser
  // requires; the piece is placed whenever they actually pick something.
  if (MouseIn(IMAGE_X, TOOLBAR_Y1, ICON_W, ICON_H)) { void importImage(); return; }
  if (MouseIn(TOOLBAR_CANCEL_X, TOOLBAR_Y1, ICON_W, ICON_H)) { cancelEditingAndExit(); return; }
  if (MouseIn(TOOLBAR_CLEAR_X, TOOLBAR_Y1, ICON_W, ICON_H)) { clearBoard(); afterEdit(); return; }
  if (MouseIn(TOOLBAR_UNDO_X, TOOLBAR_Y1, ICON_W, ICON_H)) { undo(); afterEdit(); return; }
  if (MouseIn(TOOLBAR_REDO_X, TOOLBAR_Y1, ICON_W, ICON_H)) { redo(); afterEdit(); return; }
  if (MouseIn(SYMMETRY_X, TOOLBAR_Y1, ICON_W, ICON_H)) { State.symmetry = !State.symmetry; return; }

  if (State.picker === 'shape') {
    for (let i = 0; i < SHAPE_TOOLS.length; i++) {
      const r = getPickerItemRect(i);
      if (MouseIn(r.x, r.y, r.w, r.h)) { State.tool = SHAPE_TOOLS[i]; State.picker = null; return; }
    }
  }

  if (MouseIn(TOOL_PEN_X, TOOLBAR_Y2, ICON_W, ICON_H)) { State.tool = 'pen'; State.picker = null; return; }
  if (MouseIn(TOOL_FILL_X, TOOLBAR_Y2, ICON_W, ICON_H)) { State.filled = !State.filled; return; }
  if (MouseIn(TOOL_SHAPE_X, TOOLBAR_Y2, ICON_W, ICON_H)) { State.picker = State.picker === 'shape' ? null : 'shape'; return; }
  if (MouseIn(TOOL_TEXT_X, TOOLBAR_Y2, ICON_W, ICON_H)) { State.tool = 'text'; State.picker = null; return; }
  if (MouseIn(TOOL_BUCKET_X, TOOLBAR_Y2, ICON_W, ICON_H)) { State.tool = 'bucket'; State.picker = null; return; }
  if (MouseIn(TOOL_ERASER_X, TOOLBAR_Y2, ICON_W, ICON_H)) { State.tool = 'eraser'; State.picker = null; return; }
  if (MouseIn(TOOL_COLOR_X, TOOLBAR_Y2, ICON_W, ICON_H)) { openColorPicker(); return; }
  if (MouseIn(TOOL_SELECT_X, TOOLBAR_Y2, ICON_W, ICON_H)) { State.tool = 'select'; State.picker = null; return; }

  if (MouseIn(STROKE_BAR_X, STROKE_Y, STROKE_BAR_W, STROKE_H)) {
    if (typeof MouseX === 'number') updateStrokeFromPointerX(MouseX);
    else State.thickness = State.thickness >= STROKE_MAX ? STROKE_MIN : State.thickness + 2;
    return;
  }

  if (State.picker !== 'shape') {
    if (MouseIn(BOUNDS_X, BOUNDS_Y, BOUNDS_W, BOUNDS_H)) { State.showBounds = !State.showBounds; return; }
    if (hitBox(E2.moveHdr)) { State.tool = State.tool === 'move' ? 'pen' : 'move'; return; } // toggle drag-move
    if (hitBox(E2.up)) { moveBy(0, -MOVE_STEP); return; }
    if (hitBox(E2.down)) { moveBy(0, MOVE_STEP); return; }
    if (hitBox(E2.left)) { moveBy(-MOVE_STEP, 0); return; }
    if (hitBox(E2.right)) { moveBy(MOVE_STEP, 0); return; }
    if (hitBox(E2.rotL)) { applyTransform(-ROTATE_STEP, 0); return; }
    if (hitBox(E2.rotR)) { applyTransform(ROTATE_STEP, 0); return; }
    if (hitBox(E2.scUp)) { applyTransform(0, SCALE_STEP); return; }
    if (hitBox(E2.scDn)) { applyTransform(0, -SCALE_STEP); return; }
    if (hitBox(E2.fH)) { flipCanvas('x'); return; }
    if (hitBox(E2.fV)) { flipCanvas('y'); return; }
  }
}

export function onKeyDown(evt: KeyboardEvent) {
  if (evt.key === 'Escape' && DialogFocusItem?.Asset?.Group && DRAW_GROUPS.includes(DialogFocusItem.Asset.Group.Name)) {
    leaveEditor();
  }
}
