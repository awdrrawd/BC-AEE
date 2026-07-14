import {getCanvas, getCanvasRect} from '@/core/bc';
import {mutateState} from '@/core/store';
import {settings} from '@/core/settings';
import {runtime} from '@/core/runtime';
import {darken, hexToRgb, rgba} from '@/util/color';
import {clamp} from '@/util/math';
import {openColorPicker} from '@/controllers/uiController';

export function setBgEnabled(enabled: boolean) {
  settings.bgEnabled.set(enabled);
  saveBgAndRefresh();
}

export function setBgColor(color: string) {
  settings.bgColor.set(color);
  saveBgAndRefresh();
}

export function setGridEnabled(enabled: boolean) {
  settings.bgGridEnabled.set(enabled);
  saveBgAndRefresh();
}

export function setGridMode(mode: 'line' | 'checker') {
  settings.bgGridMode.set(mode);
  saveBgAndRefresh();
}

export function setGridColor(color: string) {
  settings.bgGridColor.set(color);
  saveBgAndRefresh();
}

export function setGridPx(px: number) {
  settings.bgGridPx.set(clamp(px || 25, 5, 200));
  saveBgAndRefresh();
}

export function setGridOpacity(opacity: number) {
  settings.bgGridOpacity.set(clamp(opacity, 0, 1));
  saveBgAndRefresh();
}

export function setGridLayer(layer: 'below' | 'above') {
  settings.bgGridLayer.set(layer);
  saveBgAndRefresh();
}

export function setBgImageEnabled(enabled: boolean) {
  settings.bgImgEnabled.set(enabled);
  if (enabled && settings.bgImgUrl.get() && !runtime.bgImageEl) loadBgImage(settings.bgImgUrl.get());
  saveBgAndRefresh();
}

export function setBgImageUrl(url: string) {
  settings.bgImgUrl.set(url);
  mutateState(draft => {
    draft.bg.imageLoaded = false;
  });
  if (url) loadBgImage(url);
  else {
    runtime.bgImageEl = null;
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
  const initial = kind === 'solid' ? settings.bgColor.get() : settings.bgGridColor.get();
  openColorPicker(initial, hex => {
    if (kind === 'solid') setBgColor(hex);
    else setGridColor(hex);
  });
}

export function saveBgAndRefresh() {
  const needHook = settings.bgEnabled.get() || settings.bgGridEnabled.get() || (settings.bgImgEnabled.get() && runtime.bgImageEl?.complete);
  if (needHook) applyBgHook();
  else removeBgHook();
  try {
    if (CharacterAppearanceSelection) {
      CharacterLoadCanvas?.(CharacterAppearanceSelection);
    }
  } catch {
    // Ignore refresh errors while changing screens.
  }
}

export function loadBgImage(url: string) {
  runtime.bgImageEl = null;
  if (!url) return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    runtime.bgImageEl = img;
    mutateState(draft => {
      draft.bg.imageLoaded = true;
    });
    saveBgAndRefresh();
  };
  img.onerror = () => {
    runtime.bgImageEl = null;
    mutateState(draft => {
      draft.bg.imageLoaded = false;
    });
  };
  img.src = url;
}

export function drawBgGrid(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, forceLayer?: 'below' | 'above') {
  if (!settings.bgGridEnabled.get()) return;
  const layer = forceLayer || settings.bgGridLayer.get();
  if (!layer) return;
  ctx.save();
  const rgb = hexToRgb(settings.bgGridColor.get() || '#ffffff');
  const opacity = settings.bgGridOpacity.get();
  // Every fourth line is drawn a little stronger, so the grid reads at a glance.
  const color = rgba(rgb, opacity);
  const color2 = rgba(rgb, Math.min(1, opacity + 0.15));
  const px = settings.bgGridPx.get() || 25;
  const bigPx = px * 4;

  if (settings.bgGridMode.get() === 'line') {
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
    if ('src' in img && typeof img.src === 'string' && img.src.includes('Backgrounds/Dressing') && CurrentScreen === 'Appearance') {
      const canvas = this.canvas;
      if (canvas?.width > 0 && canvas?.height > 0) {
        this.save();
        const solid = settings.bgEnabled.get();
        const image = settings.bgImgEnabled.get() && runtime.bgImageEl?.complete;
        const hasBg = solid || image;
        if (!hasBg && !settings.bgGridEnabled.get()) {
          this.restore();
          return drawOriginal();
        }
        if (solid) {
          this.fillStyle = settings.bgColor.get();
          this.fillRect(0, 0, canvas.width, canvas.height);
        }
        if (image) {
          originalDrawImage.call(this, runtime.bgImageEl!, 0, 0, runtime.bgImageEl!.width, runtime.bgImageEl!.height, 0, 0, canvas.width, canvas.height);
        }
        if (!hasBg) drawOriginal();
        if (settings.bgGridLayer.get() === 'below') drawBgGrid(this, canvas, 'below');
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
  if (!settings.bgGridEnabled.get() || settings.bgGridLayer.get() !== 'above' || CurrentScreen !== 'Appearance') return;
  const canvas = getCanvas();
  const ctx = canvas?.getContext('2d');
  if (canvas && ctx) drawBgGrid(ctx, canvas, 'above');
}

export function defaultBgSettingsPosition() {
  const rect = getCanvasRect();
  if (!rect) return {left: 360, top: 120};
  return {
    left: rect.left + rect.width * 0.38,
    top: rect.top + rect.height * 0.15,
  };
}
