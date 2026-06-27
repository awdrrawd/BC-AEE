import type {MirrorCopyFlags, PendingTransform, PickerContext} from '@/core/types';

type ColorPickerLiveChange = (hex: string, preview?: boolean) => void;
type HoverFlashData = { item: Item; overrides: Map<number, number> };

export interface Runtime {
  initialized: boolean;
  currentRenderChar: Character | null;
  assetGroupMap: Map<string, string>;
  itemColorChar: Character | null;
  itemColorItem: Item | null;
  itemColorDirty: boolean;
  pickerContext: PickerContext | null;
  colorPickerLiveChange: ColorPickerLiveChange | null;
  colorPickerInitialHex: string;
  colorPickerAlpha: number;
  offsetPreview: { x: number; y: number } | null;
  hoverLayerIdx: string | null;
  hoverCooldownUntil: number;
  hoverHighlightAnimFrame: number | null;
  hoverHighlightStartTime: number | null;
  hoverFlashData: HoverFlashData | null;
  hoverCharFlashData: HoverFlashData | null;
  hoverCharActive: boolean;
  hoverCharGroup: string | null;
  hoverCharHiddenGroup: Set<string>;
  hoverCharAnimFrame: number | null;
  hoverCharTimer: number | null;
  hoverCharStartTime: number | null;
  // Hover try-on preview (Cloth-mode grid): temporarily wear the hovered item
  // on the main character without committing it. Backup holds the real worn
  // item (by reference, preserving its Property) so it can be restored exactly.
  hoverTryOnActive: boolean;
  hoverTryOnGroup: string | null;
  hoverTryOnAsset: string | null;
  hoverTryOnBackup: Item | null;
  pendingTransform: PendingTransform | null;
  pendingTransformApplied: number;
  mirrorCopyFlags: MirrorCopyFlags | null;
  lastMatrixData: Float32Array | null;
  lastMatrixLocation: WebGLUniformLocation | null;
  lastGl: WebGL2RenderingContext | null;
  originalUniformMatrix4fv: typeof WebGL2RenderingContext.prototype.uniformMatrix4fv | null;
  originalDrawArrays: typeof WebGL2RenderingContext.prototype.drawArrays | null;
  bgImageEl: HTMLImageElement | null;
  originalCanvasDrawImage: typeof CanvasRenderingContext2D.prototype.drawImage | null;
  inAppearanceRun: boolean;
  // The exact layer (by object identity) BC is about to draw, captured right
  // before each BeforeDraw call. Lets us target the correct layer even when an
  // asset has several layers sharing the same Name (matching by name alone would
  // always resolve to the first one).
  currentDrawLayerItem: Item | null;
  currentDrawLayerIndex: number | null;
}

export const runtime: Runtime = {
  initialized: false,
  currentRenderChar: null,
  assetGroupMap: new Map<string, string>(),
  itemColorChar: null,
  itemColorItem: null,
  itemColorDirty: false,
  pickerContext: null,
  colorPickerLiveChange: null,
  colorPickerInitialHex: '#FFFFFF',
  colorPickerAlpha: 255,
  offsetPreview: null,
  hoverLayerIdx: null,
  hoverCooldownUntil: 0,
  hoverHighlightAnimFrame: null,
  hoverHighlightStartTime: null,
  hoverFlashData: null,
  hoverCharFlashData: null,
  hoverCharActive: false,
  hoverCharGroup: null,
  hoverCharHiddenGroup: new Set<string>(),
  hoverCharAnimFrame: null,
  hoverCharTimer: null,
  hoverCharStartTime: null,
  hoverTryOnActive: false,
  hoverTryOnGroup: null,
  hoverTryOnAsset: null,
  hoverTryOnBackup: null,
  pendingTransform: null,
  pendingTransformApplied: 0,
  mirrorCopyFlags: null,
  lastMatrixData: null,
  lastMatrixLocation: null,
  lastGl: null,
  originalUniformMatrix4fv: null,
  originalDrawArrays: null,
  bgImageEl: null,
  originalCanvasDrawImage: null,
  inAppearanceRun: false,
  currentDrawLayerItem: null,
  currentDrawLayerIndex: null,
};
