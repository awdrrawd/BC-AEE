import {settings} from '@/core/settings';
import {readUiTheme, THEME_PRESETS} from '@/core/theme';
import {runtime} from '@/core/runtime';
import {getState, mutateState} from '@/core/store';
import {getLayerDisplayName} from '@/core/bc';
import {startHoverHighlight, stopHoverHighlight} from '@/controllers/uiController';

type DrawAt = {x: number; y: number; zoom: number; heightResize?: boolean};
type DrawCapture = {url: string; x: number; y: number; order: number};
type CanvasMap = {ox: number; oy: number; sx: number; sy: number; yStart: number};
type AlphaData = {bounds: {x: number; y: number; w: number; h: number}; mask: Uint8Array; mw: number; mh: number; scale: number};
type PickHit = {asset: Asset; group: AssetGroup; area: number; order: number};

const captures = new Map<Asset, DrawCapture[]>();
let frame = new Map<Asset, DrawCapture[]>();
const layerCaptures = new Map<number, DrawCapture[]>();
let layerFrame = new Map<number, DrawCapture[]>();
const archive = new Map<AssetGroupName, {asset: Asset; list: DrawCapture[]}>();
const alphaCache = new Map<string, AlphaData | null>();
let drawAt: DrawAt | null = null;
let frameDrawAt: DrawAt | null = null;
let hovered: PickHit | null = null;
let lastPick: {x: number; y: number; key: string; groupName: AssetGroupName} | null = null;
let layerLabels: Array<{index: number; x: number; y: number; w: number; h: number}> = [];
let hoveredLayerIndex: number | null = null;
let outlineCanvas: HTMLCanvasElement | null = null;

const OUTLINE_WIDTH = 3;
const OUTLINE_SAMPLES = 20;
const PICK_TOP = 115;

export function appearancePickerEnabled(): boolean {
  return settings.hoverOutlineColor.get() !== 'off' || settings.appearancePick.get() || layerPickerEnabled();
}

function layerPickerEnabled(): boolean {
  const state = getState();
  return state.visible && !!state.item && state.layerPickerMode !== 'off';
}

function inSupportedAppearanceMode(): boolean {
  if (!appearancePickerEnabled() || CurrentScreen !== 'Appearance' || !CharacterAppearanceSelection) return false;
  if (CharacterAppearanceMode !== '' && CharacterAppearanceMode !== 'Cloth') return false;
  if (DialogFocusItem) return false;
  return true;
}

export function captureAppearanceDraw(character: Character, x: number, y: number, zoom: number, heightResize?: boolean) {
  if (!(inSupportedAppearanceMode() || layerPickerEnabled()) || character !== CharacterAppearanceSelection || zoom > 2) return;
  frameDrawAt = {x, y, zoom, heightResize};
}

export function captureAppearanceImage(source: unknown, x: number, y: number, options?: DrawOptions) {
  if (!(inSupportedAppearanceMode() || layerPickerEnabled()) || runtime.currentRenderChar !== CharacterAppearanceSelection || typeof source !== 'string') return;
  if (options?.Alpha === 0) return;
  const asset = matchAsset(source);
  if (!asset) return;
  const transform = options as DrawOptions & {TranslationX?: number; TranslationY?: number};
  const order = appearanceImageOrder(asset, source);
  const capture = {url: source, x: x - (transform?.TranslationX ?? 0), y: y - (transform?.TranslationY ?? 0), order};
  const list = frame.get(asset) ?? [];
  list.push(capture);
  frame.set(asset, list);
  const state = getState();
  const layerIndex = matchCurrentItemLayer(source, state.item);
  if (layerPickerEnabled() && layerIndex >= 0) {
    const layerList = layerFrame.get(layerIndex) ?? [];
    layerList.push(capture);
    layerFrame.set(layerIndex, layerList);
  }
}

export function commitAppearancePickerFrame() {
  if (!inSupportedAppearanceMode() && !layerPickerEnabled()) {
    hovered = null;
    return;
  }
  if (frameDrawAt) {
    drawAt = frameDrawAt;
    frameDrawAt = null;
  }
  if (frame.size) {
    captures.clear();
    for (const [asset, list] of frame) {
      captures.set(asset, list);
      archive.set(asset.Group.Name, {asset, list});
    }
    frame = new Map();
  }
  if (layerFrame.size) {
    layerCaptures.clear();
    for (const [index, list] of layerFrame) layerCaptures.set(index, list);
    layerFrame = new Map();
  }
  hovered = inSupportedAppearanceMode() ? pickAt(MouseX, MouseY)[0] ?? null : null;
}

export function invalidateAppearancePicker() {
  captures.clear();
  frame.clear();
  layerCaptures.clear();
  layerFrame.clear();
  layerLabels = [];
  hovered = null;
}

export function drawAppearancePickerOutline() {
  drawDetailedLayerPicker();
  const state = getState();
  if (layerPickerEnabled() && state.layerPickerMode === 'normal') {
    const index = pickLayerAt(MouseX, MouseY)[0];
    if (index != null) drawLayerOutline(index);
  }
  if (settings.hoverOutlineColor.get() === 'off' || !inSupportedAppearanceMode()) return;
  const groupHover = findGroupHover();
  const hit = hovered ?? groupHover;
  if (!hit) return;
  const list = captures.get(hit.asset) ?? archive.get(hit.group.Name)?.list;
  const map = canvasMap();
  if (!list?.length || !map) return;

  const drawable: Array<{cap: DrawCapture; image: CanvasImageSource; width: number; height: number}> = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const cap of list) {
    const image = pickImage(cap.url);
    if (!image) continue;
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const p1 = canvasToScreen(cap.x, cap.y, map);
    const p2 = canvasToScreen(cap.x + width, cap.y + height, map);
    minX = Math.min(minX, p1.x); minY = Math.min(minY, p1.y);
    maxX = Math.max(maxX, p2.x); maxY = Math.max(maxY, p2.y);
    drawable.push({cap, image, width, height});
  }
  if (!drawable.length || !Number.isFinite(minX)) return;
  const pad = OUTLINE_WIDTH + 2;
  const bx = Math.max(0, Math.floor(minX - pad));
  const by = Math.max(0, Math.floor(minY - pad));
  const bw = Math.min(2000, Math.ceil(maxX + pad)) - bx;
  const bh = Math.min(1000, Math.ceil(maxY + pad)) - by;
  const off = getOutlineCanvas(bw, bh);
  if (!off || bw <= 0 || bh <= 0) return;

  const blit = (dx: number, dy: number) => {
    for (const entry of drawable) {
      const point = canvasToScreen(entry.cap.x, entry.cap.y, map);
      off.ctx.save();
      off.ctx.translate(point.x - bx + dx, point.y - by + dy);
      off.ctx.scale(map.sx, map.sy);
      off.ctx.drawImage(entry.image, 0, 0);
      off.ctx.restore();
    }
  };
  off.ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < OUTLINE_SAMPLES; i++) {
    const angle = i / OUTLINE_SAMPLES * Math.PI * 2;
    blit(Math.cos(angle) * OUTLINE_WIDTH, Math.sin(angle) * OUTLINE_WIDTH);
  }
  off.ctx.globalCompositeOperation = 'destination-out';
  blit(0, 0);
  off.ctx.globalCompositeOperation = 'source-in';
  off.ctx.fillStyle = outlineColor();
  off.ctx.fillRect(0, 0, bw, bh);
  MainCanvas.save();
  MainCanvas.globalAlpha = 0.9;
  MainCanvas.drawImage(off.canvas, 0, 0, bw, bh, bx, by, bw, bh);
  MainCanvas.restore();
}

export function handleAppearancePickerClick(x = MouseX, y = MouseY): boolean {
  if (handleLayerPickerClick(x, y)) return true;
  if (!settings.appearancePick.get() || !inSupportedAppearanceMode()) return false;
  const hits = pickAt(x, y);
  if (!hits.length) return false;
  const key = hits.map(hit => hit.group.Name).join(',');
  const same = lastPick && Math.hypot(x - lastPick.x, y - lastPick.y) <= 18 && lastPick.key === key;
  const previous = same ? hits.findIndex(hit => hit.group.Name === lastPick?.groupName) : -1;
  const hit = hits[previous < 0 ? 0 : (previous + 1) % hits.length];
  lastPick = {x, y, key, groupName: hit.group.Name};
  return openItemEditor(hit.group);
}

/** Canvas labels have no DOM node of their own, so callers use this to keep
 * hover/click handling from falling through to BC's controls behind them. */
export function isLayerPickerLabelPoint(x = MouseX, y = MouseY): boolean {
  return layerPickerEnabled() && getState().layerPickerMode === 'detail'
    && layerLabels.some(label => x >= label.x && x <= label.x + label.w && y >= label.y && y <= label.y + label.h);
}

function handleLayerPickerClick(x: number, y: number): boolean {
  const state = getState();
  if (!layerPickerEnabled()) return false;
  let index = state.layerPickerMode === 'detail'
    ? layerLabels.find(label => x >= label.x && x <= label.x + label.w && y >= label.y && y <= label.y + label.h)?.index
    : undefined;
  if (index == null) index = pickLayerAt(x, y)[0];
  if (index == null) return false;
  mutateState(draft => {
    draft.selectedLayer = String(index);
    if (!draft.editTool) draft.editTool = 'xy';
    if (!draft.editTools.length) draft.editTools = ['xy'];
  });
  return true;
}

function pickLayerAt(x: number, y: number): number[] {
  const map = canvasMap();
  if (!map || !layerPickerEnabled()) return [];
  const point = screenToCanvas(x, y, map);
  const hits: Array<{index: number; order: number; area: number}> = [];
  for (const [index, list] of layerCaptures) {
    let opaque = false, area = 0;
    for (const cap of list) {
      const image = pickImage(cap.url);
      const alpha = image ? alphaData(cap.url, image) : null;
      const width = image?.naturalWidth || image?.width || 0;
      const height = image?.naturalHeight || image?.height || 0;
      const bounds = alpha?.bounds ?? (width && height ? {x: 0, y: 0, w: width, h: height} : null);
      if (!bounds) continue;
      area += bounds.w * bounds.h;
      const px = point.x - cap.x, py = point.y - cap.y;
      if (px >= bounds.x && py >= bounds.y && px < bounds.x + bounds.w && py < bounds.y + bounds.h && opaqueAt(alpha, px, py)) opaque = true;
    }
    if (opaque) hits.push({index, order: layerOrder(index), area});
  }
  return hits.sort((a, b) => (b.order - a.order) || (a.area - b.area)).map(hit => hit.index);
}

function layerOrder(index: number): number {
  const state = getState();
  const layerName = state.layers[index]?.Name ?? '';
  let order = index;
  CharacterAppearanceSelection?.AppearanceLayers?.forEach((layer, position) => {
    if (layer.Asset === state.item?.Asset && (layer.Name ?? '') === layerName) order = position;
  });
  return order;
}

function drawDetailedLayerPicker() {
  const state = getState();
  layerLabels = [];
  if (!layerPickerEnabled() || state.layerPickerMode !== 'detail') {
    syncLabelHover(null);
    return;
  }
  const map = canvasMap();
  if (!map || !layerCaptures.size) {
    syncLabelHover(null);
    return;
  }
  const rows: Array<{index: number; minX: number; maxX: number; anchorY: number; label: string}> = [];
  for (const [index, list] of layerCaptures) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const cap of list) {
      const image = pickImage(cap.url);
      const alpha = image ? alphaData(cap.url, image) : null;
      const width = image?.naturalWidth || image?.width || 0;
      const height = image?.naturalHeight || image?.height || 0;
      const bounds = alpha?.bounds ?? (width && height ? {x: 0, y: 0, w: width, h: height} : null);
      if (!bounds) continue;
      const p1 = canvasToScreen(cap.x + bounds.x, cap.y + bounds.y, map);
      const p2 = canvasToScreen(cap.x + bounds.x + bounds.w, cap.y + bounds.y + bounds.h, map);
      minX = Math.min(minX, p1.x); minY = Math.min(minY, p1.y);
      maxX = Math.max(maxX, p2.x); maxY = Math.max(maxY, p2.y);
    }
    if (!Number.isFinite(minX)) continue;
    rows.push({index, minX, maxX, anchorY: (minY + maxY) / 2, label: getLayerDisplayName(state.layers[index], String(index))});
  }
  rows.sort((a, b) => a.anchorY - b.anchorY);
  const accent = readUiTheme().accent;
  const personCenter = map.ox + 250 * map.sx;
  const left: typeof rows = [];
  const right: typeof rows = [];
  for (const row of rows) {
    const center = (row.minX + row.maxX) / 2;
    if (center < personCenter - 8 || (Math.abs(center - personCenter) <= 8 && left.length <= right.length)) left.push(row);
    else right.push(row);
  }
  MainCanvas.save();
  MainCanvas.font = 'bold 22px Arial';
  MainCanvas.textBaseline = 'middle';
  const labelWidth = Math.min(300, Math.max(130, ...rows.map(row => MainCanvas.measureText(row.label).width + 28)));
  // Mirror the two equal-width columns around the character: the left
  // column ends at -300, while the right one begins at +300.
  const leftX = Math.max(12, personCenter - 300 - labelWidth);
  const rightX = Math.min(1990 - labelWidth, personCenter + 300);
  drawLabelSide(left, 'left', personCenter, accent, leftX, labelWidth);
  drawLabelSide(right, 'right', personCenter, accent, rightX, labelWidth);
  MainCanvas.restore();
  const labelHover = layerLabels.find(label => MouseX >= label.x && MouseX <= label.x + label.w && MouseY >= label.y && MouseY <= label.y + label.h)?.index ?? null;
  syncLabelHover(labelHover);
  if (labelHover != null) drawLayerOutline(labelHover);
}

function drawLabelSide(
  rows: Array<{index: number; minX: number; maxX: number; anchorY: number; label: string}>,
  side: 'left' | 'right',
  personCenter: number,
  accent: string,
  columnX: number,
  width: number,
) {
  let nextY = 125;
  for (const row of rows) {
    const height = 38;
    const y = Math.max(nextY, Math.min(930 - height, row.anchorY - height / 2));
    nextY = y + height + 8;
    const x = Math.min(1990 - width, columnX);
    const edgeX = side === 'left' ? row.minX : row.maxX;
    const elbowX = side === 'left' ? personCenter - 235 : personCenter + 235;
    const labelEdgeX = side === 'left' ? x + width : x;
    MainCanvas.strokeStyle = accent;
    MainCanvas.lineWidth = 3;
    MainCanvas.beginPath();
    MainCanvas.moveTo(edgeX, row.anchorY);
    MainCanvas.lineTo(elbowX, y + height / 2);
    MainCanvas.lineTo(labelEdgeX, y + height / 2);
    MainCanvas.stroke();
    MainCanvas.fillStyle = 'rgba(9,9,15,0.88)';
    MainCanvas.fillRect(x, y, width, height);
    MainCanvas.strokeRect(x, y, width, height);
    MainCanvas.fillStyle = '#FFFFFF';
    MainCanvas.textAlign = 'left';
    MainCanvas.fillText(row.label, x + 12, y + height / 2);
    layerLabels.push({index: row.index, x, y, w: width, h: height});
  }
}

function syncLabelHover(index: number | null) {
  if (hoveredLayerIndex === index) return;
  if (hoveredLayerIndex !== null && settings.hoverHighlight.get()) stopHoverHighlight(true);
  hoveredLayerIndex = index;
  const item = getState().item;
  if (index !== null && item && settings.hoverHighlight.get()) startHoverHighlight(item, String(index));
}

function drawLayerOutline(index: number) {
  const list = layerCaptures.get(index);
  const map = canvasMap();
  if (!list?.length || !map) return;
  const drawable: Array<{cap: DrawCapture; image: HTMLImageElement}> = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const cap of list) {
    const image = pickImage(cap.url);
    if (!image) continue;
    const alpha = alphaData(cap.url, image);
    const bounds = alpha?.bounds ?? {x: 0, y: 0, w: image.naturalWidth || image.width, h: image.naturalHeight || image.height};
    const p1 = canvasToScreen(cap.x + bounds.x, cap.y + bounds.y, map);
    const p2 = canvasToScreen(cap.x + bounds.x + bounds.w, cap.y + bounds.y + bounds.h, map);
    minX = Math.min(minX, p1.x); minY = Math.min(minY, p1.y);
    maxX = Math.max(maxX, p2.x); maxY = Math.max(maxY, p2.y);
    drawable.push({cap, image});
  }
  if (!drawable.length) return;
  const pad = OUTLINE_WIDTH + 2;
  const bx = Math.max(0, Math.floor(minX - pad)), by = Math.max(0, Math.floor(minY - pad));
  const bw = Math.min(2000, Math.ceil(maxX + pad)) - bx, bh = Math.min(1000, Math.ceil(maxY + pad)) - by;
  const off = getOutlineCanvas(bw, bh);
  if (!off) return;
  const blit = (dx: number, dy: number) => {
    for (const entry of drawable) {
      const point = canvasToScreen(entry.cap.x, entry.cap.y, map);
      off.ctx.save();
      off.ctx.translate(point.x - bx + dx, point.y - by + dy);
      off.ctx.scale(map.sx, map.sy);
      off.ctx.drawImage(entry.image, 0, 0);
      off.ctx.restore();
    }
  };
  off.ctx.globalCompositeOperation = 'lighter';
  for (let sample = 0; sample < OUTLINE_SAMPLES; sample++) {
    const angle = sample / OUTLINE_SAMPLES * Math.PI * 2;
    blit(Math.cos(angle) * OUTLINE_WIDTH, Math.sin(angle) * OUTLINE_WIDTH);
  }
  off.ctx.globalCompositeOperation = 'destination-out';
  blit(0, 0);
  off.ctx.globalCompositeOperation = 'source-in';
  off.ctx.fillStyle = readUiTheme().accent;
  off.ctx.fillRect(0, 0, bw, bh);
  MainCanvas.drawImage(off.canvas, 0, 0, bw, bh, bx, by, bw, bh);
}

function openItemEditor(group: AssetGroup): boolean {
  const character = CharacterAppearanceSelection;
  if (!character || typeof AppearanceItemColor !== 'function') return false;
  const item = InventoryGet(character, group.Name);
  if (!item || !item.Asset.Layer?.some(layer => !layer.CopyLayerColor && layer.AllowColorize && !layer.HideColoring)) return false;
  character.FocusGroup = group as AssetItemGroup;
  const mode = CharacterAppearanceMode;
  AppearanceItemColor(character, item, group.Name, mode === 'Cloth' || mode === 'Color' ? mode : '');
  hovered = null;
  return true;
}

function pickAt(x: number, y: number): PickHit[] {
  const map = canvasMap();
  if (!map || !inSupportedAppearanceMode() || captures.size === 0 || y < PICK_TOP) return [];
  const rightLimit = CharacterAppearanceMode === 'Cloth' ? 1246 : 1026;
  if (x < map.ox || x > Math.min(map.ox + 500 * map.sx, rightLimit)) return [];
  const point = screenToCanvas(x, y, map);
  const hits: PickHit[] = [];
  for (const [asset, list] of captures) {
    const group = pickableGroup(asset);
    if (!group) continue;
    let area = 0, hitOrder = -1;
    let opaque = false;
    for (const cap of list) {
      const image = pickImage(cap.url);
      const alpha = image ? alphaData(cap.url, image) : null;
      const width = image?.naturalWidth || image?.width || 0;
      const height = image?.naturalHeight || image?.height || 0;
      const bounds = alpha?.bounds ?? (width && height ? {x: 0, y: 0, w: width, h: height} : null);
      if (!bounds) continue;
      area += bounds.w * bounds.h;
      const px = point.x - cap.x;
      const py = point.y - cap.y;
      if (px < bounds.x || py < bounds.y || px >= bounds.x + bounds.w || py >= bounds.y + bounds.h) continue;
      if (opaqueAt(alpha, px, py)) {
        opaque = true;
        hitOrder = Math.max(hitOrder, cap.order);
      }
    }
    if (opaque) hits.push({asset, group, area, order: hitOrder >= 0 ? hitOrder : stackOrder(asset)});
  }
  return hits.sort((a, b) => (b.order - a.order) || (a.area - b.area));
}

function pickableGroup(asset: Asset): AssetGroup | null {
  const group = asset.Group;
  if (!CharacterAppearanceGroups?.some(candidate => candidate.Name === group.Name)) return null;
  if (typeof AppearanceGroupAllowed === 'function' && !AppearanceGroupAllowed(CharacterAppearanceSelection!, group.Name)) return null;
  return group;
}

function findGroupHover(): PickHit | null {
  const groupName = runtimeGroupHover();
  if (!groupName) return null;
  const record = archive.get(groupName);
  return record ? {asset: record.asset, group: record.asset.Group, area: 0, order: 0} : null;
}

function runtimeGroupHover(): AssetGroupName | null {
  return runtime.hoverCharGroup as AssetGroupName | null;
}

function matchAsset(url: string): Asset | null {
  const file = url.slice(url.lastIndexOf('/') + 1).split(/[?#]/, 1)[0].replace(/\.png$/i, '');
  let best: Asset | null = null;
  for (const layer of CharacterAppearanceSelection?.AppearanceLayers ?? []) {
    const asset = layer.Asset;
    if (asset?.Name && file.startsWith(asset.Name) && (!best || asset.Name.length > best.Name.length)) best = asset;
  }
  return best;
}

function matchCurrentItemLayer(url: string, item: Item | null): number {
  const asset = item?.Asset;
  const layers = asset?.Layer;
  if (!asset || !layers?.length) return -1;
  const file = imageFileName(url);
  if (!file.startsWith(asset.Name)) return -1;
  const named = layers.filter(layer => layer.Name).map(layer => layer.Name!);
  return layers.findIndex(layer => layer.Name
    ? file.endsWith(`_${layer.Name}`) || file === layer.Name
    : !named.some(name => file.endsWith(`_${name}`) || file === name));
}

function appearanceImageOrder(asset: Asset, url: string): number {
  const file = imageFileName(url);
  const named = (asset.Layer ?? []).filter(layer => layer.Name).map(layer => layer.Name!);
  let best = -1;
  CharacterAppearanceSelection?.AppearanceLayers?.forEach((layer, index) => {
    if (layer.Asset !== asset) return;
    const name = layer.Name ?? '';
    const matches = name
      ? file.endsWith(`_${name}`) || file === name
      : !named.some(candidate => file.endsWith(`_${candidate}`) || file === candidate);
    if (matches) best = Math.max(best, index);
  });
  return best >= 0 ? best : stackOrder(asset);
}

function imageFileName(url: string): string {
  return url.slice(url.lastIndexOf('/') + 1).split(/[?#]/, 1)[0].replace(/\.png$/i, '');
}

function canvasMap(): CanvasMap | null {
  const character = CharacterAppearanceSelection;
  if (!character || !drawAt) return null;
  const heightRatio = drawAt.heightResize === false ? 1 : (character.HeightRatio ?? 1);
  const xOffset = CharacterAppearanceXOffset?.(character, heightRatio) ?? 0;
  const yOffset = CharacterAppearanceYOffset?.(character, heightRatio) ?? 0;
  const yCutOff = yOffset >= 0 || ServerPlayerIsInChatRoom();
  const yStart = CanvasUpperOverflow + (yCutOff ? -yOffset / heightRatio : 0);
  const sourceHeight = 1000 / heightRatio + (yCutOff ? 0 : -yOffset / heightRatio);
  const destinationY = yCutOff ? 0 : yOffset;
  return {
    ox: drawAt.x + xOffset * drawAt.zoom,
    oy: drawAt.y + destinationY * drawAt.zoom,
    sx: 500 * heightRatio * drawAt.zoom / 500,
    sy: (1000 - destinationY) * drawAt.zoom / sourceHeight,
    yStart,
  };
}

function canvasToScreen(x: number, y: number, map: CanvasMap) {
  return {x: map.ox + x * map.sx, y: map.oy + (y - map.yStart) * map.sy};
}

function screenToCanvas(x: number, y: number, map: CanvasMap) {
  return {x: (x - map.ox) / map.sx, y: (y - map.oy) / map.sy + map.yStart};
}

function pickImage(url: string): HTMLImageElement | null {
  const image = GLDrawImageCache.get(url) ?? DrawCacheImage.get(url);
  return image && (image.naturalWidth || image.width) > 1 ? image : null;
}

function alphaData(url: string, image: HTMLImageElement): AlphaData | null {
  if (alphaCache.has(url)) return alphaCache.get(url) ?? null;
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height || width * height > 4_000_000) return null;
  let result: AlphaData | null = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', {willReadFrequently: true});
    if (!context) return null;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, width, height).data;
    const scale = 4, mw = Math.ceil(width / scale), mh = Math.ceil(height / scale);
    const mask = new Uint8Array(mw * mh);
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let py = 0; py < height; py++) for (let px = 0; px < width; px++) {
      if (pixels[(py * width + px) * 4 + 3] <= 8) continue;
      mask[Math.floor(py / scale) * mw + Math.floor(px / scale)] = 1;
      minX = Math.min(minX, px); minY = Math.min(minY, py);
      maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
    }
    if (maxX >= minX) result = {bounds: {x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1}, mask, mw, mh, scale};
  } catch { result = null; }
  alphaCache.set(url, result);
  if (alphaCache.size > 300) alphaCache.delete(alphaCache.keys().next().value!);
  return result;
}

function opaqueAt(alpha: AlphaData | null, x: number, y: number): boolean {
  if (!alpha) return true;
  const mx = Math.floor(x / alpha.scale), my = Math.floor(y / alpha.scale);
  return mx >= 0 && my >= 0 && mx < alpha.mw && my < alpha.mh && alpha.mask[my * alpha.mw + mx] === 1;
}

function stackOrder(asset: Asset): number {
  let result = -1;
  CharacterAppearanceSelection?.AppearanceLayers?.forEach((layer, index) => { if (layer.Asset === asset) result = index; });
  return result;
}

function getOutlineCanvas(width: number, height: number) {
  if (width <= 0 || height <= 0) return null;
  outlineCanvas ??= document.createElement('canvas');
  if (outlineCanvas.width < width) outlineCanvas.width = Math.ceil(width);
  if (outlineCanvas.height < height) outlineCanvas.height = Math.ceil(height);
  const context = outlineCanvas.getContext('2d');
  if (!context) return null;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalCompositeOperation = 'source-over';
  context.globalAlpha = 1;
  context.clearRect(0, 0, width, height);
  return {canvas: outlineCanvas, ctx: context};
}

function outlineColor(): string {
  const selected = settings.hoverOutlineColor.get();
  if (selected === 'theme') return readUiTheme().accent;
  if (selected === 'custom') return settings.hoverOutlineCustomColor.get();
  return THEME_PRESETS.find(preset => preset.id === selected)?.accent ?? readUiTheme().accent;
}
