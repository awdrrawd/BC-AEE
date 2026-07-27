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
export const SG_LAYER_KEYS = Object.values(SG_LAYER_KEY);

// ---- Free-draw mask targets ----------------------------------------------
// Perf: masking every non-body group (~90) is slow. Curate common clothing.
export const MASK_TARGET_GROUPS = ([
  'Cloth', 'ClothLower', 'ClothAccessory',
  'Bra', 'Corset', 'Panties', 'Socks', 'Shoes',
  'Suit', 'SuitLower', 'Gloves', 'Hat',
  'Glasses', 'Mask', 'Necklace', 'Bracelet',
  'TailStraps', 'Wings',
] as unknown) as AssetGroupName[];

export const MASK_PRIORITY = 99;
export const MASK_APPLY_TO_ABOVE = false;

// ---- Free-draw ×3 ---------------------------------------------------------
export const DRAW_ASSET = 'DrawingBoard';
export const PROP_KEY = 'CustomDraw';
export const SLOT_COUNT = 3;
export const DRAW_GROUPS = (['ItemCanvas1', 'ItemCanvas2', 'ItemCanvas3'] as unknown) as AssetGroupName[];

export const DRAW_X = 500, DRAW_Y = 0;
export const BOARD_W = 250, BOARD_H = 500;

// Mask image is body-sized (500×1000), matching BC's own glove masks.
export const MASK_IMG_W = 500, MASK_IMG_H = 1000;
export const MASK_ALIGN = {x: 0, y: 0, scale: 1};

// ---- Toolbar layout (canvas UI, coords in BC's 2000×1000 space) ----------
export const ICON_W = 90, ICON_H = 90;
export const TOOLBAR_STEP = 100;

// Row 1 (y=25), laid out right-to-left.
export const TOOLBAR_Y1 = 25;
export const TOOLBAR_ROW1_RIGHT = 1885;
export const TOOLBAR_ROW1 = ['exit', 'accept', 'cancel', 'clear', 'undo', 'mask'];
export const row1X = (id: string) => TOOLBAR_ROW1_RIGHT - TOOLBAR_ROW1.indexOf(id) * TOOLBAR_STEP;

// Row 2 (y=125), right-to-left.
export const TOOLBAR_Y2 = 125;
export const TOOLBAR_ROW2_RIGHT = 1785;
export const TOOLBAR_ROW2 = ['color', 'eraser', 'bucket', 'text', 'shape', 'fill', 'pen'];
export const row2X = (id: string) => TOOLBAR_ROW2_RIGHT - TOOLBAR_ROW2.indexOf(id) * TOOLBAR_STEP;

// Row 3 (y=225): stroke slider.
export const STROKE_Y = 225, STROKE_H = 50;
export const STROKE_LABEL_X = 1485, STROKE_LABEL_W = 90;
export const STROKE_BAR_X = 1585, STROKE_BAR_W = 390;
export const STROKE_FRAME_X = 1485, STROKE_FRAME_W = 490;
export const STROKE_MIN = 1, STROKE_MAX = 20;

// Shape picker panel (y=290). Gap 5, 5 per row.
export const PICKER_X = 1485, PICKER_Y = 290, PICKER_W = 490;
export const PICKER_ITEM = 90, PICKER_GAP = 5, PICKER_PAD = 10, PICKER_PER_ROW = 5;

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
export const MASK_X = row1X('mask');
export const TOOL_COLOR_X = row2X('color');
export const TOOL_ERASER_X = row2X('eraser');
export const TOOL_BUCKET_X = row2X('bucket');
export const TOOL_TEXT_X = row2X('text');
export const TOOL_SHAPE_X = row2X('shape');
export const TOOL_FILL_X = row2X('fill');
export const TOOL_PEN_X = row2X('pen');
