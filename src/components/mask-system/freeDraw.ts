// Free-draw ×3. Each slot = TWO assets:
//   - DrawingBoard (plain Extended item, in ItemCanvasN) → our drawing editor.
//     The drawing itself lives in its Property.CustomDraw (compressed dataURL).
//   - Mask companion (ItemCanvasNMask, hidden group) → destination-out hiding.
//
// The VISIBLE drawing is painted PER-CHARACTER in a DrawCharacter hook
// (renderOverlay), decoding each character's own Property.CustomDraw. We do NOT
// use a real image layer for it: BC caches a layer's GL texture by URL globally,
// so every character sharing the asset would show one image and remote viewers
// couldn't see per-character drawings. The manual overlay reads each character's
// synced Property, so other AEE players see everyone's drawings.
//
// Transforms are self-contained: move = offsetX/Y (drag with the 位移 mode or
// the arrow buttons); rotate/scale/mirror bake into the board-canvas pixels.
// Mask priority is left to the game's own layering (default 99).

import {
  FAMILY, DRAW_ASSET, PROP_KEY, SLOT_COUNT, DRAW_GROUPS,
  BOARD_W, BOARD_H, MASK_IMG_W, MASK_IMG_H, DRAW_X, DRAW_Y,
  MASK_TARGET_GROUPS, MASK_PRIORITY, MASK_APPLY_TO_ABOVE,
  VIS_SLOTS, DRAW_VIS_PRIORITY,
  ICON_W, ICON_H, TOOLBAR_Y1, TOOLBAR_Y2,
  STROKE_Y, STROKE_H, STROKE_LABEL_X, STROKE_LABEL_W, STROKE_BAR_X, STROKE_BAR_W,
  STROKE_FRAME_X, STROKE_FRAME_W, STROKE_MIN, STROKE_MAX,
  MPRIO_Y, MPRIO_H, MPRIO_FRAME_X, MPRIO_FRAME_W, MPRIO_LABEL_X, MPRIO_LABEL_W,
  MPRIO_BAR_X, MPRIO_BAR_W, MPRIO_MIN, MPRIO_MAX,
  PICKER_X, PICKER_Y, PICKER_W, PICKER_ITEM, PICKER_GAP, PICKER_PAD, PICKER_PER_ROW,
  MOVE_STEP, ROTATE_STEP, SCALE_STEP,
  EXIT_ICON_X, ACCEPT_ICON_X, TOOLBAR_CANCEL_X, TOOLBAR_CLEAR_X, TOOLBAR_UNDO_X, MASK_X,
  TOOL_COLOR_X, TOOL_ERASER_X, TOOL_BUCKET_X, TOOL_TEXT_X, TOOL_SHAPE_X, TOOL_FILL_X, TOOL_PEN_X,
} from './constants';
import {MaskImageProviders, TRANSPARENT_DATAURL, bustMaskTexture, getBuildingChar} from './masking';
import {SHAPE_TOOLS, SHAPE_EMOJI, drawShapePreview, floodFill, type ShapeStyle} from './shapes';
import {ICON} from './icons';
import {askText} from '@/core/prompts';
import {openColorPicker as openAeeColorPicker} from '@/controllers/uiController';

type AnyProps = Record<string, unknown>;
type Box = {x: number; y: number; w: number; h: number};

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

interface Slot {
  index: number;
  group: AssetGroupName;
  maskGroup: AssetGroupName;
  maskAsset: string;
  visGroup: AssetGroupName;   // DynamicAfterDraw companion (VIS_SLOTS only)
  visAsset: string;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  offsetX: number; offsetY: number; rotation: number; scale: number;
  isMask: boolean;
  maskPriority: number; // OverridePriority applied to the worn mask companion
  undoStack: ImageData[];
  sessionSnapshot: ImageData | null;
  sessionState: {offsetX: number; offsetY: number; rotation: number; scale: number; isMask: boolean; maskPriority: number} | null;
  _loadedSig?: string;
  _composite?: string | null;
}

function makeSlot(i: number): Slot {
  const c = document.createElement('canvas');
  c.width = BOARD_W; c.height = BOARD_H;
  return {
    index: i,
    group: DRAW_GROUPS[i],
    maskGroup: (DRAW_GROUPS[i] + 'Mask') as unknown as AssetGroupName,
    maskAsset: DRAW_GROUPS[i] + 'MaskA',
    visGroup: (DRAW_GROUPS[i] + 'Vis') as unknown as AssetGroupName,
    visAsset: DRAW_GROUPS[i] + 'VisA',
    canvas: c,
    ctx: c.getContext('2d')!,
    offsetX: 0, offsetY: 0, rotation: 0, scale: 1,
    isMask: false,
    maskPriority: MASK_PRIORITY,
    undoStack: [],
    sessionSnapshot: null,
    sessionState: null,
  };
}
const slots: Slot[] = [];
for (let i = 0; i < SLOT_COUNT; i++) slots.push(makeSlot(i));

let A: Slot | null = null;

function slotComposite(slot: Slot): string {
  if (slot._composite) return slot._composite;
  const c = document.createElement('canvas');
  c.width = MASK_IMG_W; c.height = MASK_IMG_H;
  c.getContext('2d')!.drawImage(slot.canvas, slot.offsetX, slot.offsetY, MASK_IMG_W, MASK_IMG_H);
  slot._composite = c.toDataURL('image/png');
  return slot._composite;
}
function invalidateSlot(slot: Slot) {
  slot._composite = null;
  bustMaskTexture();
}

// Mask companion shape. During a GL build it must be the BUILDING character's
// drawing (so remote players get their own mask). While locally editing this
// slot, use the live board canvas; otherwise the cached 500×1000 composite of
// that character's Property.CustomDraw (built by renderOverlay).
slots.forEach((slot) => {
  MaskImageProviders[slot.maskAsset] = () => {
    const cur = CharacterGetCurrent ? CharacterGetCurrent() : Player;
    const C = getBuildingChar() || cur;
    if (A === slot && C === cur) return slotComposite(slot); // live during local edit
    const item = C ? findSlotItem(C, slot) : null;
    const p = item?.Property as AnyProps | undefined;
    const compressed = p?.[PROP_KEY] as string | undefined;
    if (!compressed) return TRANSPARENT_DATAURL;
    const offX = (p!.OffsetX as number) || 0, offY = (p!.OffsetY as number) || 0;
    return getMaskComposite(compressed, offX, offY) ?? TRANSPARENT_DATAURL;
  };
});

// Per-character visible overlay + mask-shape composites. Both decode each
// character's own Property.CustomDraw (BC caches GL layer textures by URL
// globally, so a real per-character layer is impossible — we read each
// character's synced drawing here instead).
const overlayImgCache = new Map<string, HTMLImageElement>();
function getOverlayImage(compressed: string): HTMLImageElement {
  let img = overlayImgCache.get(compressed);
  if (!img) {
    img = new Image();
    img.src = typeof LZString !== 'undefined' ? (LZString.decompressFromBase64(compressed) || compressed) : compressed;
    overlayImgCache.set(compressed, img);
  }
  return img;
}

// 500×1000 mask composites (drawing at its offset), keyed by drawing+offset.
const maskCompositeCache = new Map<string, string>();
const maskKey = (compressed: string, offX: number, offY: number) => `${compressed.length}|${offX}|${offY}|${compressed.slice(0, 40)}`;
function getMaskComposite(compressed: string, offX: number, offY: number): string | null {
  return maskCompositeCache.get(maskKey(compressed, offX, offY)) ?? null;
}
// Returns true if newly built.
function ensureMaskComposite(compressed: string, offX: number, offY: number, img: HTMLImageElement): boolean {
  const key = maskKey(compressed, offX, offY);
  if (maskCompositeCache.has(key)) return false;
  const c = document.createElement('canvas');
  c.width = MASK_IMG_W; c.height = MASK_IMG_H;
  c.getContext('2d')!.drawImage(img, offX, offY, MASK_IMG_W, MASK_IMG_H);
  maskCompositeCache.set(key, c.toDataURL('image/png'));
  return true;
}

// DynamicAfterDraw callback — BC calls this during the vis companion layer's
// draw, once per character. Paint THAT character's own drawing at the layer
// position (X,Y) so it's per-character AND respects layer order. Draw the blink
// frame too, else the drawing vanishes whenever the character blinks.
//
// CRITICAL: the canvas passed to drawCanvas MUST come from
// AnimationGenerateTempCanvas — BC's drawCanvas keys the GL texture by the
// canvas's `name` attribute (`Img.getAttribute("name")`); a plain canvas has
// none → null key → `GLDrawImageCache.set(null,…)` poisons the cache and crashes
// AnimationPurge (`null.startsWith`), plus `GLDrawImage(null)`. The generated
// name embeds C.CharacterID + the asset, so it's per-character and AnimationPurge
// can clean it up. We stash the canvas in this character+asset's PersistentData
// and repaint it each frame (the ECHO EFMask pattern).
interface VisPersist { canvas?: HTMLCanvasElement }
function visAfterDraw(slot: Slot, data: DynamicDrawingData) {
  try {
    const C = data.C;
    // The locally-edited slot is shown live by slotDraw's preview; skip here to
    // avoid drawing the stale saved copy behind it.
    const cur = CharacterGetCurrent ? CharacterGetCurrent() : Player;
    if (A === slot && C === cur) return;
    const board = findSlotItem(C, slot);
    const p = board?.Property as AnyProps | undefined;
    const compressed = p?.[PROP_KEY] as string | undefined;
    if (!compressed) return;
    const img = getOverlayImage(compressed);
    if (!img.complete || !img.naturalWidth) return;
    const offX = (p!.OffsetX as number) || 0, offY = (p!.OffsetY as number) || 0;

    const store = data.PersistentData() as VisPersist;
    const canvas = (store.canvas ??= AnimationGenerateTempCanvas(C, data.A, MASK_IMG_W, MASK_IMG_H));
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, MASK_IMG_W, MASK_IMG_H);
    ctx.drawImage(img, offX, offY, MASK_IMG_W, MASK_IMG_H);
    data.drawCanvas(canvas, data.X, data.Y, data.AlphaMasks);
    data.drawCanvasBlink(canvas, data.X, data.Y, data.AlphaMasks);
  } catch (e) {
    console.error('[AEE Mask] Vis AfterDraw 例外：', e);
  }
}

export function renderOverlay(C: Character | null, X: number, Y: number, Zoom: number, isHeightResizeAllowed?: boolean) {
  if (!C || !Array.isArray(C.Appearance)) return;
  const cur = CharacterGetCurrent ? CharacterGetCurrent() : Player;
  for (const slot of slots) {
    const item = findSlotItem(C, slot);
    if (!item) continue;
    const p = item.Property as AnyProps | undefined;
    const compressed = p?.[PROP_KEY] as string | undefined;
    const offX = (p?.OffsetX as number) || 0, offY = (p?.OffsetY as number) || 0;
    const editingThis = (A === slot && C === cur);

    // Build this character's mask-shape composite (needed by the mask provider,
    // for masked characters too). Skip while locally editing (live shape used).
    if (compressed && !editingThis) {
      const img = getOverlayImage(compressed);
      if (img.complete && img.naturalWidth) {
        const fresh = ensureMaskComposite(compressed, offX, offY, img);
        if (fresh && isSlotMasked(C, slot) && typeof CharacterLoadCanvas === 'function') {
          setTimeout(() => { try { CharacterLoadCanvas(C); } catch { /* ignore */ } }, 0); // rebuild now the shape exists
        }
      }
    }

    if (editingThis) continue;             // drawn live by slotDraw
    if (VIS_SLOTS.has(slot.index)) continue; // visible drawn by the DynamicAfterDraw companion
    if (isSlotMasked(C, slot)) continue;   // mask mode: no visible overlay
    if (!compressed) continue;
    const img = getOverlayImage(compressed);
    if (!img.complete || !img.naturalWidth) continue;
    const rect = getCharacterDrawRect(C, X, Y, Zoom, isHeightResizeAllowed);
    MainCanvas.save();
    MainCanvas.globalAlpha = 1;
    MainCanvas.drawImage(img, rect.x + offX * (rect.w / 500), rect.y + offY * (rect.h / 1000), rect.w, rect.h);
    MainCanvas.restore();
  }
}

const State = {
  tool: 'pen', // pen | eraser | bucket | text | move | <shape>
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
};

// ---- Registration --------------------------------------------------------

function getMaskTargetGroups(): string[] {
  return MASK_TARGET_GROUPS.filter(n => !AssetGroupMap || AssetGroupMap.has(n));
}

// True once the asset actually exists in its group (survives BC asset reloads:
// if AssetAdd failed/was wiped, this stays false so we re-register).
function assetExists(group: AssetGroupName, name: string): boolean {
  const g = AssetGroupGet(FAMILY, group);
  const list = (g as unknown as {Asset?: {Name: string}[]} | null)?.Asset;
  return !!(Array.isArray(list) && list.some(a => a.Name === name));
}
function safeAssetAdd(group: AssetGroup, def: unknown, cfg: unknown, groupDef: unknown) {
  try {
    AssetAdd(group, def as AssetDefinition, cfg as ExtendedItemMainConfig, groupDef as AssetGroupDefinition);
  } catch (e) {
    console.error('[AEE Mask] AssetAdd 失敗：', e);
  }
}

// BC shows group/item names from `.Description` (AssetAdd overwrites it with the
// Name), so set the displayed labels on the registered group + asset objects.
function setDesc(group: AssetGroupName, assetName: string, label: string) {
  const g = AssetGroupGet(FAMILY, group);
  if (g) (g as unknown as {Description?: string}).Description = label;
  const a = AssetGet(FAMILY, group, assetName);
  if (a) (a as unknown as {Description?: string}).Description = label;
}

function registerDrawGroup(i: number): boolean {
  const g = DRAW_GROUPS[i];
  const slot = slots[i];
  if (assetExists(g, DRAW_ASSET)) return true;

  const group = AssetGroupGet(FAMILY, g) ?? AssetGroupAdd(FAMILY, {
    Group: g, Category: 'Appearance', AllowNone: true, Random: false, Clothing: true,
  } as unknown as AssetGroupDefinition);

  const removeOnRemove = [{Group: slot.maskGroup, Name: slot.maskAsset}];
  if (VIS_SLOTS.has(i)) removeOnRemove.push({Group: slot.visGroup, Name: slot.visAsset});
  safeAssetAdd(group, {
    Name: DRAW_ASSET,
    Value: 0, Wear: true, Extended: true, AlwaysInteract: true, Random: false,
    RemoveItemOnRemove: removeOnRemove,
  }, {}, {Group: g});
  setDesc(g, DRAW_ASSET, `自由繪圖${i + 1}`);
  return assetExists(g, DRAW_ASSET);
}

// Visible-drawing companion: a real layer with DynamicAfterDraw, so BC calls our
// AfterDraw callback during THIS layer's draw → we paint the character's own
// drawing at the layer's z-position (layer-orderable + per-character). TEST: only
// registered for VIS_SLOTS. HasImage:false → no image URL, only the AfterDraw.
function registerVisGroup(i: number): boolean {
  const slot = slots[i];
  if (assetExists(slot.visGroup, slot.visAsset)) return true;

  const group = AssetGroupGet(FAMILY, slot.visGroup) ?? AssetGroupAdd(FAMILY, {
    Group: slot.visGroup, Category: 'Appearance', Clothing: true, AllowNone: true, Random: false,
    AllowCustomize: false, Priority: DRAW_VIS_PRIORITY,
  } as unknown as AssetGroupDefinition);

  safeAssetAdd(group, {
    Name: slot.visAsset,
    Description: `自由繪圖 ${i + 1}（顯示）`,
    DynamicAfterDraw: true,
    Layer: [{HasImage: false, Priority: DRAW_VIS_PRIORITY}],
  }, null, {Group: slot.visGroup, Category: 'Appearance', Clothing: true, AllowNone: true});
  setDesc(slot.visGroup, slot.visAsset, `自由繪圖${i + 1}顯示`);
  return assetExists(slot.visGroup, slot.visAsset);
}

function registerMaskGroup(i: number): boolean {
  const slot = slots[i];
  if (assetExists(slot.maskGroup, slot.maskAsset)) return true;

  const group = AssetGroupGet(FAMILY, slot.maskGroup) ?? AssetGroupAdd(FAMILY, {
    Group: slot.maskGroup, Category: 'Appearance', Clothing: true, AllowNone: true, Random: false,
    AllowCustomize: false, Priority: MASK_PRIORITY,
  } as unknown as AssetGroupDefinition);

  safeAssetAdd(group, {
    Name: slot.maskAsset,
    Description: `繪圖遮罩 ${i + 1}（隱藏身體以外）`,
    Layer: [{
      HasImage: false,
      BlendingMode: 'destination-out',
      Priority: MASK_PRIORITY,
      TextureMask: {Groups: getMaskTargetGroups(), ApplyToAbove: MASK_APPLY_TO_ABOVE},
    }],
  }, null, {Group: slot.maskGroup, Category: 'Appearance', Clothing: true, AllowNone: true});
  setDesc(slot.maskGroup, slot.maskAsset, `繪圖遮罩${i + 1}`);
  return assetExists(slot.maskGroup, slot.maskAsset);
}

export function registerFreeDrawGroups(): boolean {
  if (typeof AssetGroupAdd !== 'function' || typeof AssetAdd !== 'function') return false;
  let ok = true;
  for (let i = 0; i < SLOT_COUNT; i++) ok = registerDrawGroup(i) && ok;
  for (let i = 0; i < SLOT_COUNT; i++) ok = registerMaskGroup(i) && ok;
  for (const i of VIS_SLOTS) ok = registerVisGroup(i) && ok;
  return ok;
}

// ---- Canvas helpers ------------------------------------------------------

function pushUndo() {
  if (!A) return;
  A.undoStack.push(A.ctx.getImageData(0, 0, BOARD_W, BOARD_H));
  if (A.undoStack.length > 20) A.undoStack.shift();
}
function undo() {
  if (!A || !A.undoStack.length) return;
  A.ctx.putImageData(A.undoStack.pop()!, 0, 0);
}
function clearBoard() {
  if (!A) return;
  pushUndo();
  A.ctx.clearRect(0, 0, BOARD_W, BOARD_H);
}
function colorForFill(hex: string): string {
  if (typeof hex === 'string' && hex.toLowerCase() === '#ffffff') return 'white';
  return hex;
}

// AEE's own colour picker (live-updates State.color).
function openColorPicker() {
  openAeeColorPicker(State.color, (hex) => { if (hex) State.color = hex; });
}

function getCharacterDrawRect(C: Character | null, X: number, Y: number, Zoom: number, isHeightResizeAllowed?: boolean) {
  if (!C) return {x: X, y: Y, w: 500 * Zoom, h: 1000 * Zoom};
  const HeightRatio = (isHeightResizeAllowed == null || isHeightResizeAllowed === true) ? C.HeightRatio : 1;
  const XOffset = CharacterAppearanceXOffset(C, HeightRatio);
  const YOffset = CharacterAppearanceYOffset(C, HeightRatio);
  return {x: X + XOffset * Zoom, y: Y + YOffset * Zoom, w: 500 * HeightRatio * Zoom, h: 1000 * HeightRatio * Zoom};
}

interface DrawArgs {X: number; Y: number; Zoom: number; IsHeightResizeAllowed?: boolean}
const lastCharDrawArgs = new Map<number | Character, DrawArgs>();
export function cacheDrawArgs(C: Character | null, X: number, Y: number, Zoom: number, isHeightResizeAllowed?: boolean) {
  if (!C) return;
  const current = typeof CharacterGetCurrent === 'function' ? CharacterGetCurrent() : null;
  if (current && C !== current) return;
  const key = C.MemberNumber != null ? C.MemberNumber : C;
  lastCharDrawArgs.set(key, {X, Y, Zoom, IsHeightResizeAllowed: isHeightResizeAllowed});
}
function getCachedDrawArgs(C: Character | null): DrawArgs | null {
  if (!C) return null;
  const key = C.MemberNumber != null ? C.MemberNumber : C;
  return lastCharDrawArgs.get(key) || null;
}

function getBoardScreenRect() {
  const C = CharacterGetCurrent();
  const cached = getCachedDrawArgs(C);
  const base = cached
    ? getCharacterDrawRect(C, cached.X, cached.Y, cached.Zoom, cached.IsHeightResizeAllowed)
    : getCharacterDrawRect(C, DRAW_X, DRAW_Y, 1, undefined);
  const ox = A ? A.offsetX : 0, oy = A ? A.offsetY : 0;
  return {x: base.x + ox * (base.w / 500), y: base.y + oy * (base.h / 1000), w: base.w, h: base.h};
}

function toLocal(cx: number, cy: number): [number, number] {
  const rect = getBoardScreenRect();
  return [(cx - rect.x) / rect.w * BOARD_W, (cy - rect.y) / rect.h * BOARD_H];
}
function inBoardArea(cx: number, cy: number): boolean {
  const rect = getBoardScreenRect();
  return cx >= rect.x && cx <= rect.x + rect.w && cy >= rect.y && cy <= rect.y + rect.h;
}
function pointInRect(px: number, py: number, x: number, y: number, w: number, h: number): boolean {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}
function updateStrokeFromPointerX(cx: number) {
  const ratio = Math.min(1, Math.max(0, (cx - STROKE_BAR_X) / STROKE_BAR_W));
  State.thickness = Math.round(STROKE_MIN + ratio * (STROKE_MAX - STROKE_MIN));
}
function getPickerLayout(count: number) {
  const rows = Math.max(1, Math.ceil(count / PICKER_PER_ROW));
  return {rows, height: PICKER_PAD * 2 + rows * PICKER_ITEM + (rows - 1) * PICKER_GAP};
}
function getPickerItemRect(index: number) {
  const row = Math.floor(index / PICKER_PER_ROW);
  const col = index % PICKER_PER_ROW;
  return {
    x: PICKER_X + PICKER_PAD + col * (PICKER_ITEM + PICKER_GAP),
    y: PICKER_Y + PICKER_PAD + row * (PICKER_ITEM + PICKER_GAP),
    w: PICKER_ITEM, h: PICKER_ITEM,
  };
}

// ---- Mouse events --------------------------------------------------------

function canvasCoordsFromEvent(evt: MouseEvent) {
  const canvas = MainCanvas.canvas;
  const rect = canvas.getBoundingClientRect();
  return {cx: (evt.clientX - rect.left) * (canvas.width / rect.width), cy: (evt.clientY - rect.top) * (canvas.height / rect.height)};
}
function shapeStyle(): ShapeStyle {
  return {tool: State.tool, filled: State.filled, color: State.color, thickness: State.thickness};
}
function afterEdit() {
  if (!A) return;
  invalidateSlot(A);
  const C = CharacterGetCurrent ? CharacterGetCurrent() : Player;
  if (C && isSlotMasked(C, A) && typeof CharacterLoadCanvas === 'function') CharacterLoadCanvas(C);
}

function onPointerDown(evt: MouseEvent) {
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
    askText('輸入要畫上的文字：', State.lastText).then(text => {
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
    A.ctx.beginPath();
    A.ctx.moveTo(local[0], local[1]);
  } else {
    State.snapshotBeforeShape = A.ctx.getImageData(0, 0, BOARD_W, BOARD_H);
  }
}

function onPointerMove(evt: MouseEvent) {
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
  if (!State.isPressing) return;
  const local = toLocal(cx, cy);
  if (State.tool === 'pen' || State.tool === 'eraser') {
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
    A.ctx.lineTo(local[0], local[1]);
    A.ctx.stroke();
  } else {
    A.ctx.globalCompositeOperation = 'source-over';
    A.ctx.putImageData(State.snapshotBeforeShape!, 0, 0);
    drawShapePreview(A.ctx, shapeStyle(), State.startX, State.startY, local[0], local[1]);
  }
}

function onPointerUp(evt: MouseEvent) {
  if (!A) return;
  if (State.draggingStroke) { State.draggingStroke = false; return; }
  if (State.draggingPriority) { State.draggingPriority = false; commitMaskPriority(); return; }
  if (State.dragging) { State.dragging = false; afterEdit(); return; }
  if (!State.isPressing) return;
  State.isPressing = false;
  A.ctx.globalCompositeOperation = 'source-over';
  if (State.tool !== 'pen' && State.tool !== 'eraser') {
    const {cx, cy} = canvasCoordsFromEvent(evt);
    const local = toLocal(cx, cy);
    A.ctx.putImageData(State.snapshotBeforeShape!, 0, 0);
    drawShapePreview(A.ctx, shapeStyle(), State.startX, State.startY, local[0], local[1]);
    State.snapshotBeforeShape = null;
  }
  afterEdit();
}

let listenersAttached = false;
function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;
  MainCanvas.canvas.addEventListener('mousedown', onPointerDown);
  MainCanvas.canvas.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);
}
function detachListeners() {
  if (!listenersAttached) return;
  listenersAttached = false;
  MainCanvas.canvas.removeEventListener('mousedown', onPointerDown);
  MainCanvas.canvas.removeEventListener('mousemove', onPointerMove);
  window.removeEventListener('mouseup', onPointerUp);
}

// ---- Transform (self-contained; baked into the drawing) ------------------

function applyTransform(rotateDeg: number, scaleDelta: number) {
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

function flipCanvas(axis: 'x' | 'y') {
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

function moveBy(dx: number, dy: number) {
  if (!A) return;
  A.offsetX += dx; A.offsetY += dy;
  afterEdit();
}

function contrastColor(hex: string): string {
  const h = (hex || '#000000').replace('#', '');
  const r = parseInt(h.substring(0, 2), 16) || 0;
  const g = parseInt(h.substring(2, 4), 16) || 0;
  const b = parseInt(h.substring(4, 6), 16) || 0;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? 'black' : 'white';
}

// ---- Mask toggle & companions --------------------------------------------

// Property key on the DrawingBoard item that remembers this slot's mask
// priority across on/off toggles + reloads (and syncs to other players).
const PROP_MASK_PRIO = 'MaskPriority';

function isSlotMasked(C: Character | null, slot: Slot): boolean {
  return !!(C && InventoryGet(C, slot.maskGroup));
}

// Push the slot's priority onto the WORN companion(s) as OverridePriority. BC
// uses it as that layer's priority: for the mask (ApplyToAbove:false → masks
// only clothing below it) and, for VIS_SLOTS, for the visible-drawing layer
// (so the 順位 slider reorders the drawing itself).
function applyMaskPriority(C: Character | null, slot: Slot) {
  if (!C) return;
  const setOn = (item: Item | null) => {
    if (!item) return;
    if (!CommonIsObject(item.Property)) item.Property = {};
    (item.Property as AnyProps).OverridePriority = slot.maskPriority;
  };
  setOn(InventoryGet(C, slot.maskGroup));
  if (VIS_SLOTS.has(slot.index)) setOn(InventoryGet(C, slot.visGroup));
}

// Wear/remove the visible companion (VIS_SLOTS) so it's worn exactly when the
// slot has a drawing and is NOT in mask mode (mask mode hides the visible, as
// before). Idempotent (acts only on mismatch); deferred + push so it syncs.
let visRefreshPending = false;
function syncVisCompanion(C: Character | null, slot: Slot) {
  if (!C || !VIS_SLOTS.has(slot.index)) return;
  const board = findSlotItem(C, slot);
  const hasDraw = !!(board?.Property as AnyProps | undefined)?.[PROP_KEY];
  const shouldWear = hasDraw && !isSlotMasked(C, slot);
  const worn = !!InventoryGet(C, slot.visGroup);
  if (shouldWear === worn) { if (worn) applyMaskPriority(C, slot); return; }
  if (shouldWear) {
    InventoryWear(C, slot.visAsset, slot.visGroup, null, null, null, null as never, false);
    applyMaskPriority(C, slot);
  } else {
    InventoryRemove(C, slot.visGroup, false);
  }
  if (!visRefreshPending) {
    visRefreshPending = true;
    setTimeout(() => { visRefreshPending = false; try { CharacterRefresh(C, true, false); } catch { /* ignore */ } }, 0);
  }
}

// Read the remembered priority off the DrawingBoard item (default 99).
function loadMaskPriority(slot: Slot, boardItem: Item | null) {
  const p = boardItem?.Property as AnyProps | undefined;
  const v = p?.[PROP_MASK_PRIO];
  slot.maskPriority = typeof v === 'number' ? v : MASK_PRIORITY;
}

function toggleSlotMask() {
  if (!A) return;
  const C = CharacterGetCurrent ? CharacterGetCurrent() : Player;
  if (!C) return;
  if (isSlotMasked(C, A)) {
    InventoryRemove(C, A.maskGroup, false);
    A.isMask = false;
  } else {
    invalidateSlot(A);
    InventoryWear(C, A.maskAsset, A.maskGroup, null, null, null, null as never, false);
    applyMaskPriority(C, A); // honour the remembered priority on the fresh companion
    A.isMask = true;
  }
  invalidateSlot(A);
  // Push=true syncs the worn/removed mask companion to the server so others see it.
  CharacterRefresh(C, true, false);
}

// Live-update during a priority-slider drag: ONLY move the value (cheap, like
// the stroke slider) so dragging stays smooth. The heavy mask rebuild happens
// once on release — see commitMaskPriority.
function updatePriorityFromPointerX(cx: number) {
  if (!A) return;
  const ratio = Math.min(1, Math.max(0, (cx - MPRIO_BAR_X) / MPRIO_BAR_W));
  A.maskPriority = Math.round(MPRIO_MIN + ratio * (MPRIO_MAX - MPRIO_MIN));
}

// On release: apply to the worn companion, persist to the DrawingBoard item,
// rebuild once + push-sync so others get it.
function commitMaskPriority() {
  if (!A) return;
  const C = CharacterGetCurrent ? CharacterGetCurrent() : Player;
  const board = C ? findSlotItem(C, A) : null;
  if (board) {
    if (!CommonIsObject(board.Property)) board.Property = {};
    (board.Property as AnyProps)[PROP_MASK_PRIO] = A.maskPriority;
  }
  applyMaskPriority(C, A);
  invalidateSlot(A);
  if (C) CharacterRefresh(C, true, false);
}

// ---- Extended item callbacks ---------------------------------------------

function findSlotItem(C: Character | null, slot: Slot): Item | null {
  if (!C || !Array.isArray(C.Appearance)) return null;
  return C.Appearance.find(it => it.Asset?.Group?.Name === slot.group && it.Asset?.Name === DRAW_ASSET) || null;
}

function ensureSlotCanvasFromProperty(slot: Slot, item: Item | null) {
  const p = item && item.Property ? (item.Property as AnyProps) : null;
  const compressed = p ? (p[PROP_KEY] as string | undefined) : undefined;
  const sig = compressed ? (compressed.length + ':' + compressed.slice(0, 16)) : '';
  if (slot._loadedSig === sig) return;
  slot._loadedSig = sig;
  slot.offsetX = (p?.OffsetX as number) || 0;
  slot.offsetY = (p?.OffsetY as number) || 0;
  if (!compressed) {
    slot.ctx.clearRect(0, 0, BOARD_W, BOARD_H);
    invalidateSlot(slot);
    return;
  }
  const dataUrl = typeof LZString !== 'undefined' ? (LZString.decompressFromBase64(compressed) || compressed) : compressed;
  const img = new Image();
  img.onload = () => {
    slot.ctx.clearRect(0, 0, BOARD_W, BOARD_H);
    slot.ctx.drawImage(img, 0, 0, BOARD_W, BOARD_H);
    invalidateSlot(slot);
    const C = CharacterGetCurrent ? CharacterGetCurrent() : Player;
    if (C && typeof CharacterLoadCanvas === 'function') CharacterLoadCanvas(C);
  };
  img.src = dataUrl;
}

// Keep the LOCAL player's board canvases current (they feed the editor + the
// mask-companion shape). Remote characters render via renderOverlay from their
// own Property, so we don't thrash the shared slot canvas with their drawings.
export function syncSlots(C: Character | null) {
  if (!C || C !== Player || !Array.isArray(C.Appearance)) return;
  for (const slot of slots) {
    const item = findSlotItem(C, slot);
    if (item) ensureSlotCanvasFromProperty(slot, item);
    // Keep the remembered priority + the worn companion's OverridePriority in
    // sync (e.g. after a relog restored the board but a fresh companion). Skip
    // the slot being edited — this runs every frame, and reloading its stored
    // value would clobber an in-progress slider drag (the value snapping back
    // each frame is what made the drag feel stuck/laggy).
    if (A !== slot) {
      loadMaskPriority(slot, item);
      if (isSlotMasked(C, slot)) applyMaskPriority(C, slot);
    }
    syncVisCompanion(C, slot); // wear/remove the visible companion (VIS_SLOTS)
  }
}

function slotLoad(i: number) {
  A = slots[i];
  attachListeners();
  const C = CharacterGetCurrent ? CharacterGetCurrent() : Player;
  A.isMask = isSlotMasked(C, A);
  const item = DialogFocusItem;
  loadMaskPriority(A, item);
  if (item && item.Property) {
    const p = item.Property as AnyProps;
    A.offsetX = (p.OffsetX as number) || 0;
    A.offsetY = (p.OffsetY as number) || 0;
    if (p[PROP_KEY]) { A._loadedSig = undefined; ensureSlotCanvasFromProperty(A, item); }
  }
  A.sessionSnapshot = A.ctx.getImageData(0, 0, BOARD_W, BOARD_H);
  A.sessionState = {offsetX: A.offsetX, offsetY: A.offsetY, rotation: A.rotation, scale: A.scale, isMask: A.isMask, maskPriority: A.maskPriority};
  State.picker = null;
  if (State.tool === 'move') State.tool = 'pen';
  invalidateSlot(A);
  if (C && typeof CharacterLoadCanvas === 'function') CharacterLoadCanvas(C);
  DialogExtendedMessage = '直接在角色身上繪圖；「位移」可拖曳整張圖，旋轉/縮放/鏡射用按鈕；「遮罩」把圖當形狀隱藏身體以外';
}

function slotExit() { detachListeners(); }

function slotInit(_i: number, C: Character, Item: Item, Push = true, Refresh = true): boolean {
  if (!CommonIsObject(Item.Property)) Item.Property = {};
  if (Refresh) CharacterRefresh(C, Push, false);
  return false;
}

function leaveEditor() {
  detachListeners();
  const editing = A;
  if (typeof DialogLeaveFocusItem === 'function') {
    DialogLeaveFocusItem();
  } else if (typeof ExtendedItemExit === 'function') {
    ExtendedItemExit();
    DialogFocusItem = null;
    (globalThis as unknown as Record<string, unknown>).DialogFocusItemName = null;
    DialogExtendedMessage = '';
  }
  A = null;
  if (editing) {
    invalidateSlot(editing);
    const C = CharacterGetCurrent ? CharacterGetCurrent() : Player;
    if (C && typeof CharacterLoadCanvas === 'function') CharacterLoadCanvas(C);
  }
}

function cancelEditingAndExit() {
  if (A) {
    if (A.sessionSnapshot) A.ctx.putImageData(A.sessionSnapshot, 0, 0);
    const C = CharacterGetCurrent ? CharacterGetCurrent() : Player;
    if (A.sessionState) {
      A.offsetX = A.sessionState.offsetX;
      A.offsetY = A.sessionState.offsetY;
      A.rotation = A.sessionState.rotation;
      A.scale = A.sessionState.scale;
      if (C && isSlotMasked(C, A) !== A.sessionState.isMask) {
        if (A.sessionState.isMask) { invalidateSlot(A); InventoryWear(C, A.maskAsset, A.maskGroup, null, null, null, null as never, false); }
        else InventoryRemove(C, A.maskGroup, false);
      }
      A.isMask = A.sessionState.isMask;
      A.maskPriority = A.sessionState.maskPriority;
      if (C && A.isMask) applyMaskPriority(C, A); // revert the live-dragged priority
    }
    A.undoStack = [];
  }
  State.picker = null;
  leaveEditor();
}

function applyToCharacter() {
  if (!A) return;
  const C = CharacterGetCurrent ? CharacterGetCurrent() : Player;
  if (!C) return;
  const item = findSlotItem(C, A) || InventoryGet(C, A.group);
  if (!item) return;

  const dataUrl = A.canvas.toDataURL('image/png');
  const compressed = typeof LZString !== 'undefined' ? LZString.compressToBase64(dataUrl) : dataUrl;
  if (!CommonIsObject(item.Property)) item.Property = {};
  const p = item.Property as AnyProps;
  p[PROP_KEY] = compressed;
  p.OffsetX = A.offsetX;
  p.OffsetY = A.offsetY;
  p[PROP_MASK_PRIO] = A.maskPriority;
  A._loadedSig = compressed.length + ':' + compressed.slice(0, 16);

  applyMaskPriority(C, A);
  invalidateSlot(A);
  CharacterRefresh(C, true, false); // Push=true → ServerPlayerAppearanceSync (others get the drawing)
}

function onKeyDown(evt: KeyboardEvent) {
  if (evt.key === 'Escape' && DialogFocusItem?.Asset?.Group && DRAW_GROUPS.includes(DialogFocusItem.Asset.Group.Name)) {
    leaveEditor();
  }
}

const ICON_INSET = 15;
function drawIconBtn(x: number, y: number, w: number, h: number, bgColor: string, iconSrc: string, hover: string) {
  DrawButton(x, y, w, h, '', bgColor, undefined, hover);
  if (iconSrc) DrawImageResize(iconSrc, x + ICON_INSET, y + ICON_INSET, w - ICON_INSET * 2, h - ICON_INSET * 2);
}

function slotDraw() {
  if (!A) return;
  const rect = getBoardScreenRect();
  MainCanvas.drawImage(A.canvas, rect.x, rect.y, rect.w, rect.h); // live preview

  // Row 1
  DrawButton(MASK_X, TOOLBAR_Y1, ICON_W, ICON_H, '', A.isMask ? '#4CAF50' : 'White', 'Icons/Private.png', '遮罩：把這張圖當形狀，隱藏身體以外的東西（再按一次切回純繪製）');
  drawIconBtn(TOOLBAR_UNDO_X, TOOLBAR_Y1, ICON_W, ICON_H, 'White', ICON.undo, '復原上一筆');
  DrawButton(TOOLBAR_CLEAR_X, TOOLBAR_Y1, ICON_W, ICON_H, '', 'White', 'Icons/Trash.png', '清除整張畫布');
  DrawButton(TOOLBAR_CANCEL_X, TOOLBAR_Y1, ICON_W, ICON_H, '', 'White', 'Icons/Cancel.png', '取消（不保留這次所有編輯並退出）');

  // Row 2
  drawIconBtn(TOOL_PEN_X, TOOLBAR_Y2, ICON_W, ICON_H, State.tool === 'pen' ? 'cyan' : 'White', ICON.pen, '畫筆');
  drawIconBtn(TOOL_FILL_X, TOOLBAR_Y2, ICON_W, ICON_H, State.filled ? 'cyan' : 'White', State.filled ? ICON.fillSolid : ICON.fillOutline, State.filled ? '填滿：實心（點一下切回線框）' : '填滿：線框（點一下切成實心）');
  DrawButton(TOOL_SHAPE_X, TOOLBAR_Y2, ICON_W, ICON_H, (SHAPE_EMOJI[State.tool] || '△'), State.picker === 'shape' || (SHAPE_TOOLS as readonly string[]).includes(State.tool) ? 'cyan' : 'White', undefined, '圖形（點擊展開，選擇要畫的形狀）');
  DrawButton(TOOL_TEXT_X, TOOLBAR_Y2, ICON_W, ICON_H, 'T', State.tool === 'text' ? 'cyan' : 'White', undefined, '文字（點畫布輸入文字）');
  drawIconBtn(TOOL_BUCKET_X, TOOLBAR_Y2, ICON_W, ICON_H, State.tool === 'bucket' ? 'cyan' : 'White', ICON.bucket, '填色（油漆桶）');
  drawIconBtn(TOOL_ERASER_X, TOOLBAR_Y2, ICON_W, ICON_H, State.tool === 'eraser' ? 'cyan' : 'White', ICON.eraser, '橡皮擦');
  drawIconBtn(TOOL_COLOR_X, TOOLBAR_Y2, ICON_W, ICON_H, colorForFill(State.color), ICON.color, '顏色（點擊開啟 AEE 取色器）');

  // Row 3: stroke slider
  DrawRect(STROKE_FRAME_X, STROKE_Y, STROKE_FRAME_W, STROKE_H, 'White');
  DrawEmptyRect(STROKE_FRAME_X, STROKE_Y, STROKE_FRAME_W, STROKE_H, 'Black', 2);
  DrawText('筆觸', STROKE_LABEL_X + STROKE_LABEL_W / 2, STROKE_Y + STROKE_H / 2, 'black');
  DrawButton(STROKE_BAR_X, STROKE_Y, STROKE_BAR_W, STROKE_H, '', 'White', undefined, '拖曳／點擊拉桿設定筆觸粗細');
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
    drawBox(E2.moveHdr, '位移', State.tool === 'move' ? 'cyan' : 'White', '位移：點一下後可在左側直接拖曳整張圖；或用下方方向鍵');
    drawBox(E2.rotHdr, '旋轉', 'White');
    drawBox(E2.scaleHdr, '縮放', 'White');
    drawBox(E2.mirrorHdr, '鏡射', 'White');
    drawBox(E2.up, '上', 'White'); drawBox(E2.down, '下', 'White');
    drawBox(E2.left, '左', 'White'); drawBox(E2.right, '右', 'White');
    drawBox(E2.rotL, '↺', 'White'); drawBox(E2.rotR, '↻', 'White');
    drawBox(E2.scUp, '＋', 'White'); drawBox(E2.scDn, '－', 'White');
    drawBox(E2.fH, '水平', 'White'); drawBox(E2.fV, '垂直', 'White');
  }

  // Layer-order slider (shown in both draw & mask modes; hidden only while the
  // shape picker is open). The value is remembered on the drawing and drives the
  // mask's OverridePriority when masking is on.
  if (State.picker !== 'shape') {
    DrawRect(MPRIO_FRAME_X, MPRIO_Y, MPRIO_FRAME_W, MPRIO_H, 'White');
    DrawEmptyRect(MPRIO_FRAME_X, MPRIO_Y, MPRIO_FRAME_W, MPRIO_H, 'Black', 2);
    DrawText('順位', MPRIO_LABEL_X + MPRIO_LABEL_W / 2, MPRIO_Y + MPRIO_H / 2, 'black');
    DrawButton(MPRIO_BAR_X, MPRIO_Y, MPRIO_BAR_W, MPRIO_H, '', 'White', undefined, '拖曳調整順位；數字越高，開遮罩時能蓋住越多（優先權比它低的衣物才會被隱藏）');
    const ppct = (A.maskPriority - MPRIO_MIN) / (MPRIO_MAX - MPRIO_MIN);
    MainCanvas.fillStyle = '#4CAF50';
    MainCanvas.fillRect(MPRIO_BAR_X + 4, MPRIO_Y + 4, (MPRIO_BAR_W - 8) * ppct, MPRIO_H - 8);
    DrawText(`${A.maskPriority}`, MPRIO_BAR_X + MPRIO_BAR_W / 2, MPRIO_Y + MPRIO_H / 2, 'black');
  }

  if (State.draggingStroke) {
    const screenR = State.thickness * (rect.w / BOARD_W) / 2;
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    MainCanvas.save();
    MainCanvas.beginPath();
    MainCanvas.arc(cx, cy, Math.max(screenR, 1), 0, 2 * Math.PI);
    MainCanvas.fillStyle = colorForFill(State.color);
    MainCanvas.globalAlpha = 0.85;
    MainCanvas.fill();
    MainCanvas.globalAlpha = 1;
    MainCanvas.lineWidth = 2;
    MainCanvas.strokeStyle = contrastColor(State.color);
    MainCanvas.stroke();
    MainCanvas.restore();
    DrawText(`${State.thickness}px`, cx, cy - screenR - 22, contrastColor(State.color) === 'white' ? 'black' : 'white');
  }

  DrawButton(ACCEPT_ICON_X, TOOLBAR_Y1, ICON_W, ICON_H, '', 'White', 'Icons/Accept.png', '套用並退出（保留這次所有編輯）');
  DrawButton(EXIT_ICON_X, TOOLBAR_Y1, ICON_W, ICON_H, '', 'White', 'Icons/Exit.png', '不儲存，直接退出');
}

function slotClick() {
  if (!A) return;
  if (MouseIn(ACCEPT_ICON_X, TOOLBAR_Y1, ICON_W, ICON_H)) { applyToCharacter(); leaveEditor(); return; }
  if (MouseIn(EXIT_ICON_X, TOOLBAR_Y1, ICON_W, ICON_H)) { cancelEditingAndExit(); return; }

  if (MouseIn(MASK_X, TOOLBAR_Y1, ICON_W, ICON_H)) { toggleSlotMask(); return; }
  if (MouseIn(TOOLBAR_CANCEL_X, TOOLBAR_Y1, ICON_W, ICON_H)) { cancelEditingAndExit(); return; }
  if (MouseIn(TOOLBAR_CLEAR_X, TOOLBAR_Y1, ICON_W, ICON_H)) { clearBoard(); afterEdit(); return; }
  if (MouseIn(TOOLBAR_UNDO_X, TOOLBAR_Y1, ICON_W, ICON_H)) { undo(); afterEdit(); return; }

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

  if (MouseIn(STROKE_BAR_X, STROKE_Y, STROKE_BAR_W, STROKE_H)) {
    if (typeof MouseX === 'number') updateStrokeFromPointerX(MouseX);
    else State.thickness = State.thickness >= STROKE_MAX ? STROKE_MIN : State.thickness + 2;
    return;
  }

  if (State.picker !== 'shape') {
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

export function installFreeDrawCallbacks() {
  const g = globalThis as unknown as Record<string, unknown>;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const prefix = `Inventory${DRAW_GROUPS[i]}${DRAW_ASSET}`;
    g[`${prefix}Load`] = () => { try { slotLoad(i); } catch (e) { console.error('[AEE Mask] Load 錯誤：', e); } };
    g[`${prefix}Draw`] = () => { try { slotDraw(); } catch (e) { console.error('[AEE Mask] Draw 錯誤：', e); } };
    g[`${prefix}Click`] = () => { try { slotClick(); } catch (e) { console.error('[AEE Mask] Click 錯誤：', e); } };
    g[`${prefix}Exit`] = () => { try { slotExit(); } catch (e) { console.error('[AEE Mask] Exit 錯誤：', e); } };
    g[`${prefix}Init`] = (C: Character, Item: Item, Push?: boolean, Refresh?: boolean) => slotInit(i, C, Item, Push, Refresh);
    // Visible-drawing companion's DynamicAfterDraw hook (VIS_SLOTS only): BC
    // calls Assets{Group}{Asset}AfterDraw during that layer's draw.
    if (VIS_SLOTS.has(i)) {
      const slot = slots[i];
      g[`Assets${slot.visGroup}${slot.visAsset}AfterDraw`] = (data: DynamicDrawingData) => visAfterDraw(slot, data);
    }
  }
  window.addEventListener('keydown', onKeyDown);
}
