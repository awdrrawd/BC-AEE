export type AeeTab = 'edit' | 'opacity' | 'layers' | 'settings';
export type DragMode = 'xy' | 'rot' | 'scale' | 'skew' | null;
export type TransformOverlayMode = Exclude<DragMode, null>;
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
  | 'hideLscgLayers'
  | 'showCharCtrl'
  | 'enableAeeMenu'
  | 'useAeeColorPicker'
  | 'pasteImport'
  | 'bcWheelScroll';
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

export interface AppearanceImportItem {
  Asset?: {
    Group?: {
      Name?: AssetGroupName | string;
    };
    Name?: string;
  };
  Group?: AssetGroupName | string;
  Name?: string;
  Color?: BCColor | BCColor[];
  Property?: ItemProperties;
  Difficulty?: number;
}

export interface BcxExportItem {
  Group: AssetGroupName | string;
  Name: string;
  Color?: BCColor | BCColor[];
  Property?: ItemProperties;
  Difficulty?: number;
}

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
  scaleX: number;
  scaleY: number;
  rotation: number;
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

// add: empty slot gains an item, remove: filled slot is emptied,
// modify: item/color/property changes. Drives the git-style row coloring.
export type ImportChangeType = 'add' | 'remove' | 'modify';

export interface ImportDiff {
  group: AssetGroupName | string;
  category: ImportCategoryKey;
  changeType: ImportChangeType;
  entry: AppearanceImportItem;
  fromText: string;
  toText: string;
}

export interface ImportDiffDialog {
  character: Character;
  diffs: ImportDiff[];
  originalAppearance: string;
}

export interface BgState {
  enabled: boolean;
  color: string;
  gridEnabled: boolean;
  gridMode: 'line' | 'checker';
  gridPx: number;
  gridColor: string;
  gridOpacity: number;
  gridLayer: 'below' | 'above';
  imageEnabled: boolean;
  imageUrl: string;
  imageLoaded: boolean;
  settingsOpen: boolean;
  panelLeft?: number;
  panelTop?: number;
}

export interface OffsetState {
  open: boolean;
  collapsed: boolean;
  x: number;
  y: number;
  scale: number;
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
  expandUp: boolean;
  subLeft: boolean;
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

export interface AeeState {
  version: string;
  visible: boolean;
  canvasRect: CanvasRect | null;
  tab: AeeTab;
  selectedLayer: LayerId | null;
  collapsed: boolean;
  activeDrag: DragMode;
  scaleLock: boolean;
  partsOpen: boolean;
  partsLeft: number;
  partsTop: number;
  hoverHighlight: boolean;
  hoverHighlightChar: boolean;
  hoverTryOn: boolean;
  hideLscgLayers: boolean;
  showCharCtrl: boolean;
  hideCloseup: boolean;
  hideFullbody: boolean;
  fullbodyOffsetX: number;
  enableAeeMenu: boolean;
  useAeeColorPicker: boolean;
  pasteImport: boolean;
  bcWheelScroll: boolean;
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
}
