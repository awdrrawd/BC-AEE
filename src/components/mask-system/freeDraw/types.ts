// Shared types for the free-draw slot system. Kept dependency-free so every
// other module in this folder can import from here without risking a cycle.

export type AnyProps = Record<string, unknown>;
export type Box = {x: number; y: number; w: number; h: number};

export interface SlotSessionState {
  offsetX: number;
  offsetY: number;
  rotation: number;
  scale: number;
  isMask: boolean;
  maskPriority: number;
}

export type SlotSessionPhase = 'loading' | 'editing' | 'saving' | 'closing';

// Everything which gives an editor operation identity lives here. Async work
// must retain this object and verify it is still current before touching state;
// comparing only the slot is insufficient because the same slot can be opened
// for another character while an older callback is still pending.
export interface SlotEditSession {
  readonly id: number;
  readonly slot: Slot;
  readonly character: Character;
  readonly item: Item;
  phase: SlotSessionPhase;
  dirty: boolean;
  hasDrawing: boolean;
  snapshot: ImageData | null;
  initialState: SlotSessionState | null;
}

export interface Slot {
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
  redoStack: ImageData[]; // cleared by any fresh edit (pushUndo)
  _loadedSig?: string;
  _loadToken?: number;
  _loadingSig?: string;
  _loadPromise?: Promise<boolean>;
  loading?: boolean;
  _composite?: string | null;
}
