// Per-character visible overlay + mask-shape composites. Both decode each
// character's own Property.CustomDraw (BC caches GL layer textures by URL
// globally, so a real per-character layer is impossible — we read each
// character's synced drawing here instead).

import type {AnyProps, Slot} from './types';
import {
  PROP_KEY, DRAW_ASSET, MASK_IMG_W, MASK_IMG_H, MASK_COMPOSITE_CACHE_SIZE, OVERLAY_IMAGE_CACHE_SIZE, VIS_SLOTS,
} from '../constants';
import {MaskImageProviders, TRANSPARENT_DATAURL, bustMaskTexture, getBuildingChar} from '../masking';
import {LRUCache} from '../lruCache';
import {slots, A, slotComposite, findSlotItem} from './slots';
import {isSlotMasked} from './maskToggle';
import {getCharacterDrawRect} from './geometry';

// Mask companion shape. During a GL build it must be the BUILDING character's
// drawing (so remote players get their own mask). While locally editing this
// slot, use the live board canvas; otherwise the cached 500×1000 composite of
// that character's Property.CustomDraw (built by renderOverlay).
slots.forEach((slot) => {
  const drawingImage = () => {
    const cur = CharacterGetCurrent ? CharacterGetCurrent() : Player;
    const C = getBuildingChar() || cur;
    if (A === slot && C === cur) return slotComposite(slot); // live during local edit
    const item = C ? findSlotItem(C, slot) : null;
    const p = item?.Property as AnyProps | undefined;
    const compressed = p?.[PROP_KEY] as string | undefined;
    if (!compressed) return TRANSPARENT_DATAURL;
    const offX = (p!.OffsetX as number) || 0, offY = (p!.OffsetY as number) || 0;
    return getOrBuildMaskComposite(compressed, offX, offY) ?? TRANSPARENT_DATAURL;
  };
  MaskImageProviders[slot.maskAsset] = drawingImage;
  // DrawingBoard is a normal sortable HasImage layer. Replace its otherwise
  // nonexistent PNG with this character's own full-body drawing, using the
  // same proven content-keyed GL injection path as the mask texture.
  MaskImageProviders[`/${slot.group}/${DRAW_ASSET}`] = drawingImage;
});

const overlayImgCache = new LRUCache<string, HTMLImageElement>(OVERLAY_IMAGE_CACHE_SIZE);

// Once a (remote) drawing finishes decoding, mirror the local-player path: bust
// the combined-mask cache and reload every rendered character so their mask
// shape + visible overlay appear on the very next build. Without this, remote
// characters relied on an incidental redraw happening to run AFTER the async
// decode — which is exactly why "自己沒問題、看別人不穩定": the local player got a
// guaranteed CharacterLoadCanvas on load (ensureSlotCanvasFromProperty), remote
// players got nothing. Runs once per distinct drawing, so the cost is trivial.
function refreshMaskConsumers() {
  setTimeout(() => {
    try {
      bustMaskTexture();
      if (typeof CharacterLoadCanvas !== 'function') return;
      const seen = new Set<number>();
      const list: Character[] = [];
      if (typeof Player !== 'undefined' && Player) list.push(Player);
      if (typeof ChatRoomCharacter !== 'undefined' && Array.isArray(ChatRoomCharacter)) list.push(...ChatRoomCharacter);
      for (const C of list) {
        const key = C?.MemberNumber;
        if (key != null) { if (seen.has(key)) continue; seen.add(key); }
        try { CharacterLoadCanvas(C); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }, 0);
}

function getOverlayImage(compressed: string): HTMLImageElement {
  let img = overlayImgCache.get(compressed);
  if (!img) {
    img = new Image();
    overlayImgCache.set(compressed, img);
    img.addEventListener('load', refreshMaskConsumers);
    img.src = typeof LZString !== 'undefined' ? (LZString.decompressFromBase64(compressed) || compressed) : compressed;
  }
  return img;
}

// 500×1000 mask composites (drawing at its offset), keyed by drawing+offset.
// Content-keyed (changes on every edit), so bounded with LRU eviction rather
// than left to accumulate one entry per edit ever made in the session.
const maskCompositeCache = new LRUCache<string, string>(MASK_COMPOSITE_CACHE_SIZE);
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

// Mask shape for the provider: the cached composite, or — if it's missing
// because the drawing hasn't been built by renderOverlay yet OR was evicted from
// the LRU in a busy room — build it synchronously right here as long as the
// image has decoded. Previously the provider returned TRANSPARENT whenever the
// composite wasn't cached, so a remote drawing whose composite hadn't been built
// (or got evicted) rendered with NO mask even though the drawing itself showed —
// the "可以畫圖卻無法遮罩 / 看別人不穩定" symptom. On the first decode the image
// isn't ready yet (returns null → transparent this frame); img.onload then fires
// refreshMaskConsumers to rebuild, so it appears on the next build.
function getOrBuildMaskComposite(compressed: string, offX: number, offY: number): string | null {
  const cached = getMaskComposite(compressed, offX, offY);
  if (cached) return cached;
  const img = getOverlayImage(compressed);
  if (!img.complete || !img.naturalWidth) return null; // still decoding — onload will rebuild
  ensureMaskComposite(compressed, offX, offY, img);
  return getMaskComposite(compressed, offX, offY);
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

export function visAfterDraw(slot: Slot, data: DynamicDrawingData) {
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
    if (VIS_SLOTS.has(slot.index)) continue; // rendered into C.Canvas at this layer's sorted position
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
