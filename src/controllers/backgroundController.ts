import {getCanvas, getCanvasRect} from '@/core/bc';
import {mutateState} from '@/core/store';
import {runtime} from '@/core/runtime';
import {getViewSettings} from '@/core/viewSettings';
import {darken, hexToRgb, rgba} from '@/util/color';
import {clamp} from '@/util/math';
import {openColorPicker} from '@/controllers/uiController';

export function setBgEnabled(enabled: boolean) {
  getViewSettings().bgEnabled.set(enabled);
  saveBgAndRefresh();
}

export function setBgColor(color: string) {
  getViewSettings().bgColor.set(color);
  saveBgAndRefresh();
}

export function setGridEnabled(enabled: boolean) {
  getViewSettings().bgGridEnabled.set(enabled);
  saveBgAndRefresh();
}

export function setGridMode(mode: 'line' | 'checker') {
  getViewSettings().bgGridMode.set(mode);
  saveBgAndRefresh();
}

export function setGridColor(color: string) {
  getViewSettings().bgGridColor.set(color);
  saveBgAndRefresh();
}

export function setGridPx(px: number) {
  getViewSettings().bgGridPx.set(clamp(px || 25, 5, 200));
  saveBgAndRefresh();
}

export function setGridOpacity(opacity: number) {
  getViewSettings().bgGridOpacity.set(clamp(opacity, 0, 1));
  saveBgAndRefresh();
}

export function setGridLayer(layer: 'below' | 'above') {
  getViewSettings().bgGridLayer.set(layer);
  saveBgAndRefresh();
}

export function setBgImageEnabled(enabled: boolean) {
  const view = getViewSettings();
  view.bgImgEnabled.set(enabled);
  if (enabled && view.bgImgUrl.get() && runtime.bgImageUrl !== view.bgImgUrl.get()) loadBgImage(view.bgImgUrl.get());
  saveBgAndRefresh();
}

export function setBgImageUrl(url: string) {
  getViewSettings().bgImgUrl.set(url);
  mutateState(draft => {
    draft.bg.imageLoaded = false;
  });
  if (url) loadBgImage(url);
  else {
    runtime.bgImageEl = null;
    runtime.bgImageUrl = null;
    saveBgAndRefresh();
  }
}

export function openBgSettings(open?: boolean) {
  mutateState(draft => {
    draft.bg.settingsOpen = open ?? !draft.bg.settingsOpen;
  });
}

export function moveBgSettings(left: number, top: number) {
  mutateState(draft => {
    draft.bg.panelLeft = left;
    draft.bg.panelTop = top;
  });
}

export function openBgColorPicker(kind: 'solid' | 'grid') {
  const view = getViewSettings();
  const initial = kind === 'solid' ? view.bgColor.get() : view.bgGridColor.get();
  openColorPicker(initial, hex => {
    if (kind === 'solid') setBgColor(hex);
    else setGridColor(hex);
  });
}

export function saveBgAndRefresh() {
  const view = getViewSettings();
  const needHook = view.bgEnabled.get() || view.bgGridEnabled.get() || (view.bgImgEnabled.get() && !!view.bgImgUrl.get());
  if (needHook) applyBgHook();
  else removeBgHook();
  try {
    const character = CharacterAppearanceSelection || (CurrentScreen === 'Crafting' ? CraftingPreview : null);
    if (character) CharacterLoadCanvas?.(character);
  } catch {
    // Ignore refresh errors while changing screens.
  }
}

export function loadBgImage(url: string) {
  runtime.bgImageEl = null;
  runtime.bgImageUrl = url || null;
  mutateState(draft => {
    draft.bg.imageLoaded = false;
  });
  if (!url) return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    if (runtime.bgImageUrl !== url) return;
    runtime.bgImageEl = img;
    mutateState(draft => {
      draft.bg.imageLoaded = true;
    });
    saveBgAndRefresh();
  };
  img.onerror = () => {
    if (runtime.bgImageUrl !== url) return;
    runtime.bgImageEl = null;
    mutateState(draft => {
      draft.bg.imageLoaded = false;
    });
  };
  img.src = url;
}

export function drawBgGrid(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, forceLayer?: 'below' | 'above') {
  const view = getViewSettings();
  if (!view.bgGridEnabled.get()) return;
  const layer = forceLayer || view.bgGridLayer.get();
  if (!layer) return;
  ctx.save();
  const rgb = hexToRgb(view.bgGridColor.get() || '#ffffff');
  const opacity = view.bgGridOpacity.get();
  // Every fourth line is drawn a little stronger, so the grid reads at a glance.
  const color = rgba(rgb, opacity);
  const color2 = rgba(rgb, Math.min(1, opacity + 0.15));
  const px = view.bgGridPx.get() || 25;
  const bigPx = px * 4;

  if (view.bgGridMode.get() === 'line') {
    ctx.lineWidth = 1;
    ctx.strokeStyle = color;
    for (let x = 0; x < canvas.width; x += px) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += px) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    ctx.strokeStyle = color2;
    ctx.lineWidth = 1.5;
    for (let x = 0; x < canvas.width; x += bigPx) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += bigPx) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  } else {
    for (let x = 0; x < canvas.width; x += px) {
      for (let y = 0; y < canvas.height; y += px) {
        const even = (Math.floor(x / px) + Math.floor(y / px)) % 2 === 0;
        ctx.fillStyle = even ? color : rgba(darken(rgb, 60), opacity);
        ctx.fillRect(x, y, px, px);
      }
    }
  }
  ctx.restore();
}

export function applyBgHook() {
  if (runtime.originalCanvasDrawImage) return;
  const originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;
  runtime.originalCanvasDrawImage = originalDrawImage;

  CanvasRenderingContext2D.prototype.drawImage = function (img: CanvasImageSource, ...rest: unknown[]) {
    const drawOriginal = () => Reflect.apply(originalDrawImage, this, [img, ...rest]);
    const source = 'src' in img && typeof img.src === 'string' ? img.src : '';
    const isViewBackground = CurrentScreen === 'Appearance' && source.includes('Backgrounds/Dressing')
      || CurrentScreen === 'Crafting' && source.includes('Backgrounds/CraftingWorkshop');
    if (isViewBackground) {
      const canvas = this.canvas;
      if (canvas?.width > 0 && canvas?.height > 0) {
        const view = getViewSettings();
        const imageUrl = view.bgImgUrl.get();
        if (view.bgImgEnabled.get() && imageUrl && runtime.bgImageUrl !== imageUrl) loadBgImage(imageUrl);
        this.save();
        const solid = view.bgEnabled.get();
        const image = view.bgImgEnabled.get() && runtime.bgImageUrl === imageUrl && runtime.bgImageEl?.complete;
        const hasBg = solid || image;
        if (!hasBg && !view.bgGridEnabled.get()) {
          this.restore();
          return drawOriginal();
        }
        if (solid) {
          this.fillStyle = view.bgColor.get();
          this.fillRect(0, 0, canvas.width, canvas.height);
        }
        if (image) {
          originalDrawImage.call(this, runtime.bgImageEl!, 0, 0, runtime.bgImageEl!.width, runtime.bgImageEl!.height, 0, 0, canvas.width, canvas.height);
        }
        if (!hasBg) drawOriginal();
        if (view.bgGridLayer.get() === 'below') drawBgGrid(this, canvas, 'below');
        this.restore();
        return;
      }
    }
    return drawOriginal();
  } as typeof CanvasRenderingContext2D.prototype.drawImage;
}

export function removeBgHook() {
  if (!runtime.originalCanvasDrawImage) return;
  CanvasRenderingContext2D.prototype.drawImage = runtime.originalCanvasDrawImage;
  runtime.originalCanvasDrawImage = null;
}

export function drawAboveGridIfNeeded() {
  const view = getViewSettings();
  if (!view.bgGridEnabled.get() || view.bgGridLayer.get() !== 'above'
    || (CurrentScreen !== 'Appearance' && CurrentScreen !== 'Crafting')) return;
  const canvas = getCanvas();
  const ctx = canvas?.getContext('2d');
  if (canvas && ctx) drawBgGrid(ctx, canvas, 'above');
}

export function syncViewBackground() {
  const view = getViewSettings();
  const imageUrl = view.bgImgUrl.get();
  if (view.bgImgEnabled.get() && imageUrl && runtime.bgImageUrl !== imageUrl) loadBgImage(imageUrl);
  if (view.bgEnabled.get() || view.bgGridEnabled.get() || (view.bgImgEnabled.get() && !!imageUrl)) applyBgHook();
  else removeBgHook();
}

export function defaultBgSettingsPosition() {
  const rect = getCanvasRect();
  if (!rect) return {left: 360, top: 120};
  return {
    left: rect.left + rect.width * 0.38,
    top: rect.top + rect.height * 0.15,
  };
}
