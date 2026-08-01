// Shared types for the free-draw slot system. Kept dependency-free so every
// other module in this folder can import from here without risking a cycle.

export type AnyProps = Record<string, unknown>;
export type Box = {x: number; y: number; w: number; h: number};

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
  sessionSnapshot: ImageData | null;
  sessionState: {offsetX: number; offsetY: number; rotation: number; scale: number; isMask: boolean; maskPriority: number} | null;
  _loadedSig?: string;
  _composite?: string | null;
}
