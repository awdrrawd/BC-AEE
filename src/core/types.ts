export type AeeTab = 'edit' | 'opacity' | 'layers' | 'settings';
export type ToolbarLayoutMode = 'neat' | 'free';
export type LayerPickerMode = 'off' | 'normal' | 'detail';
export type EditToolMode = 'parts' | 'xy' | 'rot' | 'scale' | 'skew' | 'mirror' | 'opacity' | 'layers' | 'layeringHide' | 'settings' | null;
export type DragMode = 'xy' | 'rot' | 'scale' | 'skew' | 'mirror' | null;
export type TransformOverlayMode = Exclude<DragMode, null> | 'mirror';
export type LayerId = 'all' | string;
export type UnknownFunction = (...args: unknown[]) => unknown;
export type LayerOverrideKey =
  | 'DrawingLeft'
  | 'DrawingTop'
  | 'Opacity'
  | 'ScaleX'
  | 'ScaleY'
  | 'Rotation'
  | 'SkewX'
  | 'SkewY'
  | 'FlipX'
  | 'FlipY'
  | 'MirrorCopy'
  | 'MirrorCopyV'
  | 'MirrorCopyAxisX'
  | 'MirrorCopyAxisY';
export type SettingKey =
  | 'hoverHighlight'
  | 'hoverHighlightChar'
  | 'hoverTryOn'
  | 'enableCopyPaste'
  | 'hideLscgLayers'
  | 'rightClickExitDrag'
  | 'showCharCtrl'
  | 'enableAeeMenu'
  | 'hideUnnecessaryAppearanceButtons'
  | 'useAeeColorPicker'
  | 'pasteImport'
  | 'bcWheelScroll'
  | 'enablePartsFilter';

export type PartsFilterMode = 'all' | 'has' | 'empty';
export type LayerManagerFilterMode = 'all' | 'custom' | 'default';
export type LayerManagerSortDirection = 'asc' | 'desc';
export type EditControl =
  | 'x'
  | 'y'
  | 'op'
  | 'sx'
  | 'sy'
  | 'rot'
  | 'skx'
  | 'sky'
  | 'fcx'
  | 'fcy'
  | 'mc';

export interface LayerPositionOverride {
  '': number;
}

export interface AeeLayerOverride {
  DrawingLeft?: LayerPositionOverride;
  DrawingTop?: LayerPositionOverride;
  Opacity?: number;
  ScaleX?: number;
  ScaleY?: number;
  Rotation?: number;
  SkewX?: number;
  SkewY?: number;
  FlipX?: boolean;
  FlipY?: boolean;
  MirrorCopy?: boolean;
  MirrorCopyV?: boolean;
  MirrorCopyAxisX?: number;
  MirrorCopyAxisY?: number;
}

declare global {
  interface ItemProperties {
    Color?: BCColor | BCColor[];
    LayerOverrides?: AeeLayerOverride[];
    /** WCE-compatible, per-item replacement for Asset.Hide. */
    wceOverrideHide?: AssetGroupName[];
  }

  interface Item {
    Group?: AssetGroupName | string;
    Name?: string;
  }
}

type Writable<T> = {
  -readonly [K in keyof T]: T[K];
};

export type WritableAssetLayer = Writable<AssetLayer>;

export type WritableAsset = Omit<Writable<Asset>, 'Layer'> & {
  Layer: readonly AssetLayer[];
};

export interface PickerContext {
  item: Item | null;
  indices: number[] | null;
  pickerLayers: AssetLayer[] | null;
}

export interface PendingTransform {
  flipX: boolean;
  flipY: boolean;
  mirrorCopy: boolean;
  mirrorCopyV: boolean;
  mirrorCopyAxisX: number;
  mirrorCopyAxisY: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  skewX: number;
  skewY: number;
}

export interface MirrorCopyFlags {
  x: boolean;
  y: boolean;
  axisX: number;
  axisY: number;
}

export interface BeforeDrawParams {
  CA?: Item;
  L?: string;
  Property?: ItemProperties;
}

export interface BeforeDrawResult {
  X?: number;
  Y?: number;
  Opacity?: number;
}

export type HookNext<Args extends unknown[] = unknown[], Result = unknown> = (args: Args) => Result;
export type HookCallback<Args extends unknown[] = unknown[], Result = unknown> = (args: Args, next: HookNext<Args, Result>) => Result;

export interface CanvasRect {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

export type ImportCategoryKey = 'clothes' | 'cosplay' | 'body' | 'restraints' | 'other';

export type ImportChangeType = 'add' | 'remove' | 'modify';

export interface ImportDiff {
  group: AssetGroupName;
  category: ImportCategoryKey;
  changeType: ImportChangeType;
  entry: ItemBundle | null;
  fromText: string;
  toText: string;
}

export interface ImportDiffDialog {
  character: Character;
  diffs: ImportDiff[];
  originalAppearance: string;
  originalBundle: ItemBundle[];
}

export interface BgState {
  imageLoaded: boolean;
  settingsOpen: boolean;
  panelLeft?: number;
  panelTop?: number;
}

export interface OffsetState {
  open: boolean;
  collapsed: boolean;
  wheelControl: boolean;
  left?: number;
  top?: number;
}

export interface PoseState {
  open: boolean;
  activeIndex: number | null;
  left?: number;
  top?: number;
}

export interface CharControlState {
  open: boolean;
  visible: boolean;
  left?: number;
  top?: number;
  bgSubOpen: boolean;
  hideSubOpen: boolean;
}

export interface ColorPickerState {
  sessionId: number;
  open: boolean;
  bcMode: boolean;
  collapsed: boolean;
  hex: string;
  initialHex: string;
  opacityPct: number;
  isDefault: boolean;
  eyedropperActive: boolean;
  left?: number;
  top?: number;
}

export interface OpacityOverlayState {
  open: boolean;
  left?: number;
  top?: number;
}

export interface TransformOverlayState {
  mode: TransformOverlayMode | null;
  left?: number;
  top?: number;
}

export interface LayerManagerState {
  open: boolean;
  closing: boolean;
  /** Snapshot of who the panel is editing (the appearance-screen selection at the moment it was opened). */
  target: Character | null;
  search: string;
  filterMode: LayerManagerFilterMode;
  sortDirection: LayerManagerSortDirection;
  /** Panel position within canvasRect, in real screen pixels. Unset until the user first drags it. */
  left?: number;
  top?: number;
}

export interface AeeState {
  version: string;
  visible: boolean;
  canvasRect: CanvasRect | null;
  tab: AeeTab;
  selectedLayer: LayerId | null;
  collapsed: boolean;
  toolbarHovered: boolean;
  toolbarPinned: boolean;
  toolbarLayout: ToolbarLayoutMode;
  layerPickerMode: LayerPickerMode;
  editTool: EditToolMode;
  editTools: EditToolMode[];
  activeDrag: DragMode;
  scaleLock: boolean;
  partsOpen: boolean;
  partsLeft: number;
  partsTop: number;
  partsFilterMode: PartsFilterMode;
  item: Item | null;
  group: string | null;
  mode: string | null;
  layers: readonly AssetLayer[];
  itemAssetName: string | null;
  itemGroupName: string | null;
  colorPicker: ColorPickerState;
  opacityOverlay: OpacityOverlayState;
  transformOverlay: TransformOverlayState;
  rotationOverlayOpen: boolean;
  bg: BgState;
  offset: OffsetState;
  pose: PoseState;
  charControl: CharControlState;
  importDialog: ImportDiffDialog | null;
  layerManager: LayerManagerState;
}

export type WardrobeSettingsTab = 'general' | 'storage' | 'background' | 'appearance' | 'panels';
export type WardrobeSortMode = 'default' | 'name' | 'favorite' | 'occupied';
export type WardrobeFilter = string | null;
export type WardrobeSourceId = 'online' | 'local' | 'sps';

export interface WardrobeSlotMeta {
  favorite: boolean;
  tags: string[];
}

export interface PendingImport {
  outfit: ItemBundle[];
  name?: string;
  meta?: WardrobeSlotMeta;
  sourceIndex?: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AnchoredRect extends Rect {
  cx: number;
  cy: number;
}

export type BackgroundChoiceType = 'color' | 'image' | 'upload' | 'url' | 'custom';

export interface OccupiedSlot {
  index: number;
  name: string;
}
