// Shared configuration for the mask system (single glove + free-draw ×3).
// Ported from the standalone userscript 自由繪圖_合併單手套.user.js (v1.9.2).

export const FAMILY = 'Female3DCG';

// Custom runtime group names aren't in BC's AssetGroupName union, so cast
// through `unknown`. (Asset-name params on BC functions are plain strings.)
const asGroup = (s: string) => s as unknown as AssetGroupName;

// ---- Single glove (one typed item, Priority 99) --------------------------
export const SG_MASK_GROUP = asGroup('SingleGloveFX');
export const SG_ASSET = 'SingleGlove';
export const SG_PRIORITY = 99;

// The "ECHO / Luzi" glove group name (the custom Luzi glove group).
export const SG_LUZI_GROUP = 'Gloves_笨笨蛋Luzi';

export type SGScope = 'gloves' | 'luzi' | 'both';
export type SGSide = 'L' | 'R';

// Three mask scopes: only Gloves / only Luzi / both.
export const SG_SCOPES: Record<SGScope, {groups: string[]}> = {
  gloves: {groups: ['Gloves']},
  luzi: {groups: [SG_LUZI_GROUP]},
  both: {groups: ['Gloves', SG_LUZI_GROUP]},
};

export interface SGOption {
  side: SGSide;
  scope: SGScope;
  Name: string; // also the displayed text (single-glove options are text-only)
}

// 6 options: left hand × {gloves, luzi, both}, then right hand.
export const SG_OPTIONS: SGOption[] = [
  {side: 'L', scope: 'gloves', Name: '左手手套'},
  {side: 'L', scope: 'luzi', Name: '左手ECHO'},
  {side: 'L', scope: 'both', Name: '左手全部'},
  {side: 'R', scope: 'gloves', Name: '右手手套'},
  {side: 'R', scope: 'luzi', Name: '右手ECHO'},
  {side: 'R', scope: 'both', Name: '右手全部'},
];

// One mask layer per scope; each provider reads the current selection.
export const SG_LAYER_KEY: Record<SGScope, string> = {
  gloves: 'SGLayerGloves',
  luzi: 'SGLayerLuzi',
  both: 'SGLayerBoth',
};

// ---- Free-draw mask targets ----------------------------------------------
// Which clothing/accessory groups the drawing can "cut through" (destination-out
// TextureMask). Reference: BC's Female3DCG appearance groups + ECHO 裸空间
// (裸空间.js clothGroups) which is the canonical TextureMask target list.
// getMaskTargetGroups() filters this to groups actually present, so ECHO/Luzi
// custom groups are safe to list even without ECHO installed.
//
// DELIBERATELY EXCLUDED (per design): body (Body*/Hands*/Arms*), hair (Hair*),
// and face/makeup (Eyes/Eyebrows/Mouth/Blush/*Shadow/*Markings/Emoticon…). Item*
// restraint groups are also excluded — the drawing is meant to hide CLOTHING,
// and masking ~60 item groups every build is costly.
export const MASK_TARGET_GROUPS = ([
  // Core clothing
  'Cloth', 'ClothLower', 'ClothOuter', 'ClothAccessory',
  'Bra', 'Corset', 'Panties', 'Garters',
  'Suit', 'SuitLower',
  'Socks', 'SocksLeft', 'SocksRight', 'Shoes',
  // Hands / arms accessories (not the body groups)
  'Gloves', 'HandAccessoryLeft', 'HandAccessoryRight',
  // Head / face wearables (accessories, NOT makeup)
  'Hat', 'Glasses', 'Mask',
  // Jewellery
  'Necklace', 'Jewelry', 'Bracelet', 'AnkletLeft', 'AnkletRight',
  // Misc wearables
  'TailStraps', 'Wings', 'Decals',
  // ECHO / Luzi custom clothing groups (interop; filtered out if absent)
  'Cloth_笨笨蛋Luzi', 'Cloth_笨笨笨蛋Luzi2',
  'ClothLower_笨笨蛋Luzi', 'ClothLower_笨笨笨蛋Luzi2',
  'ClothAccessory_笨笨蛋Luzi', 'ClothAccessory_笨笨笨蛋Luzi2',
  'Bra_笨笨蛋Luzi', 'Panties_笨笨蛋Luzi',
  'Suit_笨笨蛋Luzi', 'SuitLower_笨笨蛋Luzi',
  'Hat_笨笨蛋Luzi', 'Mask_笨笨蛋Luzi', 'Gloves_笨笨蛋Luzi',
] as unknown) as AssetGroupName[];

export const MASK_PRIORITY = 99;
export const MASK_APPLY_TO_ABOVE = false;

// ---- Content-keyed cache limits -------------------------------------------
// These caches are keyed by drawing content (dataURL / compressed string),
// which changes on every edit. Capped with LRU eviction so a long session
// (many edits, many characters' drawings) can't grow them without bound.
export const MASK_TEXTURE_CACHE_SIZE = 64; // per-GL-context WebGLTexture cache
export const MASK_IMAGE_CACHE_SIZE = 64;   // decoded HTMLImageElement cache (masking.ts)
export const MASK_COMPOSITE_CACHE_SIZE = 48; // 500x1000 mask-shape composite dataURLs
export const OVERLAY_IMAGE_CACHE_SIZE = 48;  // decoded HTMLImageElement cache (visible overlay)

// Mask-priority slider (only shown in mask mode). Drives the worn mask item's
// Property.OverridePriority → BC hides clothing layers whose Priority is below
// this value (ApplyToAbove:false). Lower = fewer items hidden. BC's own range.
export const MPRIO_MIN = 0, MPRIO_MAX = 99;

// ---- Free-draw ×3 ---------------------------------------------------------
export const DRAW_ASSET = 'DrawingBoard';
export const PROP_KEY = 'CustomDraw';
export const PROP_SPS_KEY = 'CustomDrawSPS';
export const SLOT_COUNT = 3;
export const DRAW_GROUP_PREFIX = 'ItemCanvas';
export const DRAW_GROUPS = ([1, 2, 3].map(index => `${DRAW_GROUP_PREFIX}${index}`) as unknown) as AssetGroupName[];

export const drawMaskGroupName = (group: AssetGroupName | string) => `${group as string}Mask`;
export const drawVisibleGroupName = (group: AssetGroupName | string) => `${group as string}Vis`;
export const isDrawMaskGroupName = (name: string) => name.startsWith(DRAW_GROUP_PREFIX) && name.endsWith('Mask');

// Runtime registration / peer-handshake timings. They share one owner so retry
// behaviour cannot silently drift across the mask modules.
export const MASK_INSTALL_RETRY_MS = 500;
export const MASK_REGISTRY_HEARTBEAT_MS = 4000;
export const MASK_SYNC_REPUSH_DELAY_MS = 600;
export const MASK_PEER_ANNOUNCE_INTERVAL_MS = 4000;
export const MASK_PEER_ANNOUNCE_DELAY_MS = 600;

export const DRAW_X = 500, DRAW_Y = 0;
export const BOARD_W = 250, BOARD_H = 500;

// Render every visible drawing as a real DynamicAfterDraw layer (companion
// `ItemCanvasNVis`) so all three slots are per-character and layer-orderable.
export const VIS_SLOTS = new Set<number>(Array.from({length: SLOT_COUNT}, (_, index) => index));
export const DRAW_VIS_PRIORITY = 99; // base layer priority (overridden by the 順位 slider)

// Mask image is body-sized (500×1000), matching BC's own glove masks.
export const MASK_IMG_W = 500, MASK_IMG_H = 1000;

// ---- Toolbar layout (canvas UI, coords in BC's 2000×1000 space) ----------
export const ICON_W = 90, ICON_H = 90;
export const TOOLBAR_STEP = 100;

// Row 1 (y=25), laid out right-to-left. 'image' sits here rather than in the
// tool row because row 2 has no free slot left of x=1085 that doesn't overlap
// the character/board preview (which spans x≈500–1000) — and it's a one-shot
// action like clear/undo, not a persistent tool mode.
export const TOOLBAR_Y1 = 25;
export const TOOLBAR_ROW1_RIGHT = 1885;
export const TOOLBAR_ROW1 = ['exit', 'accept', 'cancel', 'clear', 'undo', 'redo', 'mask', 'image', 'symmetry'];
export const row1X = (id: string) => TOOLBAR_ROW1_RIGHT - TOOLBAR_ROW1.indexOf(id) * TOOLBAR_STEP;

// Row 2 (y=125), right-to-left.
export const TOOLBAR_Y2 = 125;
export const TOOLBAR_ROW2_RIGHT = 1785;
export const TOOLBAR_ROW2 = ['color', 'eraser', 'bucket', 'text', 'shape', 'fill', 'select', 'pen'];
export const row2X = (id: string) => TOOLBAR_ROW2_RIGHT - TOOLBAR_ROW2.indexOf(id) * TOOLBAR_STEP;

// Row 3 (y=225): stroke slider.
export const STROKE_Y = 225, STROKE_H = 50;
export const STROKE_LABEL_X = 1485, STROKE_LABEL_W = 90;
export const STROKE_BAR_X = 1585, STROKE_BAR_W = 390;
export const STROKE_FRAME_X = 1485, STROKE_FRAME_W = 490;
export const STROKE_MIN = 1, STROKE_MAX = 20;

// Mask-priority slider row (y=500, below the transform panel; mask mode only).
export const MPRIO_Y = 500, MPRIO_H = 50;
export const MPRIO_FRAME_X = 1485, MPRIO_FRAME_W = 490;
export const MPRIO_LABEL_X = 1485, MPRIO_LABEL_W = 120;
export const MPRIO_BAR_X = 1615, MPRIO_BAR_W = 360;

// View-toggle row (y=560). Sits below the priority slider and hides with it
// while the shape picker is open — the picker overlays y=290..780.
export const BOUNDS_X = MPRIO_FRAME_X, BOUNDS_W = MPRIO_FRAME_W;
export const BOUNDS_Y = 560, BOUNDS_H = 50;

// Toolbar button states. Two deliberately different colours, because they mean
// two different things: cyan marks the ONE tool currently selected (exclusive,
// and obvious from what happens when you draw), green marks a MODE left
// switched on — 遮罩 / 對稱 / 填滿 / 外框 are the ones you can forget about and
// then wonder why the next stroke behaves oddly.
export const BTN_TOOL_ON = 'cyan';
export const BTN_MODE_ON = '#4CAF50';
export const BTN_OFF = 'White';

// Shape picker panel (y=290). Gap 5, 5 per row.
export const PICKER_X = 1485, PICKER_Y = 290, PICKER_W = 490;
export const PICKER_ITEM = 90, PICKER_GAP = 5, PICKER_PAD = 10, PICKER_PER_ROW = 5;

// Resize grip on a floating piece (imported image / box selection), board px.
// ~2× that on screen, so it stays a usable touch target.
export const SEL_HANDLE = 14;

// Edit panel: move / rotate / scale.
export const EDIT_PANEL_X = 1485, EDIT_PANEL_Y = 290, EDIT_PANEL_W = 490, EDIT_PANEL_H = 210;
export const LABEL_Y = EDIT_PANEL_Y + 10, LABEL_H = 32;
export const MOVE_STEP = 5;
export const ROTATE_STEP = 15;
export const SCALE_STEP = 0.1;

export const PAD_BTN = 40;
export const PAD_UP_X = EDIT_PANEL_X + 50, PAD_UP_Y = EDIT_PANEL_Y + 60;
export const PAD_LEFT_X = EDIT_PANEL_X, PAD_LEFT_Y = EDIT_PANEL_Y + 105;
export const PAD_RIGHT_X = EDIT_PANEL_X + 95, PAD_RIGHT_Y = EDIT_PANEL_Y + 105;
export const PAD_DOWN_X = EDIT_PANEL_X + 50, PAD_DOWN_Y = EDIT_PANEL_Y + 150;

export const ROTATE_BTN = 60;
export const ROTATE_CCW_X = EDIT_PANEL_X + 165, ROTATE_CW_X = EDIT_PANEL_X + 245, ROTATE_Y = EDIT_PANEL_Y + 60;
export const ROTATE_BAR_X = EDIT_PANEL_X + 165, ROTATE_BAR_Y = EDIT_PANEL_Y + 130, ROTATE_BAR_W = 140, ROTATE_BAR_H = 40;

export const SCALE_BTN = 60;
export const SCALE_MINUS_X = EDIT_PANEL_X + 325, SCALE_PLUS_X = EDIT_PANEL_X + 405, SCALE_Y = EDIT_PANEL_Y + 60;
export const SCALE_BAR_X = EDIT_PANEL_X + 325, SCALE_BAR_Y = EDIT_PANEL_Y + 130, SCALE_BAR_W = 140, SCALE_BAR_H = 40;

// Derived toolbar X positions.
export const EXIT_ICON_X = row1X('exit');
export const ACCEPT_ICON_X = row1X('accept');
export const TOOLBAR_CANCEL_X = row1X('cancel');
export const TOOLBAR_CLEAR_X = row1X('clear');
export const TOOLBAR_UNDO_X = row1X('undo');
export const TOOLBAR_REDO_X = row1X('redo');
export const MASK_X = row1X('mask');
export const IMAGE_X = row1X('image');
export const SYMMETRY_X = row1X('symmetry');
export const TOOL_COLOR_X = row2X('color');
export const TOOL_ERASER_X = row2X('eraser');
export const TOOL_BUCKET_X = row2X('bucket');
export const TOOL_TEXT_X = row2X('text');
export const TOOL_SHAPE_X = row2X('shape');
export const TOOL_FILL_X = row2X('fill');
export const TOOL_PEN_X = row2X('pen');
export const TOOL_SELECT_X = row2X('select');
