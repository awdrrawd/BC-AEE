import {getCanvas, getCanvasRect} from '@/core/bc';
import {getState, mutateState} from '@/core/store';
import {setAeeSetting} from '@/core/settings';
import {runtime} from '@/core/runtime';
import {openColorPicker} from '@/controllers/uiController';

export function setBgEnabled(enabled: boolean) {
  setAeeSetting('bgEnabled', enabled);
  mutateState(draft => {
    draft.bg.enabled = enabled;
  });
  saveBgAndRefresh();
}

export function setBgColor(color: string) {
  setAeeSetting('bgColor', color);
  mutateState(draft => {
    draft.bg.color = color;
  });
  saveBgAndRefresh();
}

export function setGridEnabled(enabled: boolean) {
  setAeeSetting('bgGridEnabled', enabled);
  mutateState(draft => {
    draft.bg.gridEnabled = enabled;
  });
  saveBgAndRefresh();
}

export function setGridMode(mode: 'line' | 'checker') {
  setAeeSetting('bgGridMode', mode);
  mutateState(draft => {
    draft.bg.gridMode = mode;
  });
  saveBgAndRefresh();
}

export function setGridColor(color: string) {
  setAeeSetting('bgGridColor', color);
  mutateState(draft => {
    draft.bg.gridColor = color;
  });
  saveBgAndRefresh();
}

export function setGridPx(px: number) {
  const clamped = Math.max(5, Math.min(200, px || 25));
  setAeeSetting('bgGridPx', clamped);
  mutateState(draft => {
    draft.bg.gridPx = clamped;
  });
  saveBgAndRefresh();
}

export function setGridOpacity(opacity: number) {
  const clamped = Math.max(0, Math.min(1, opacity));
  setAeeSetting('bgGridOpacity', clamped);
  mutateState(draft => {
    draft.bg.gridOpacity = clamped;
  });
  saveBgAndRefresh();
}

export function setGridLayer(layer: 'below' | 'above') {
  setAeeSetting('bgGridLayer', layer);
  mutateState(draft => {
    draft.bg.gridLayer = layer;
  });
  saveBgAndRefresh();
}

export function setBgImageEnabled(enabled: boolean) {
  setAeeSetting('bgImgEnabled', enabled);
  mutateState(draft => {
    draft.bg.imageEnabled = enabled;
  });
  if (enabled && getState().bg.imageUrl && !runtime.bgImageEl) loadBgImage(getState().bg.imageUrl);
  saveBgAndRefresh();
}

export function setBgImageUrl(url: string) {
  setAeeSetting('bgImgUrl', url);
  mutateState(draft => {
    draft.bg.imageUrl = url;
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
  const state = getState();
  const initial = kind === 'solid' ? state.bg.color : state.bg.gridColor;
  openColorPicker(initial, hex => {
    if (kind === 'solid') setBgColor(hex);
    else setGridColor(hex);
  });
}

export function saveBgAndRefresh() {
  const state = getState();
  const needHook = state.bg.enabled || state.bg.gridEnabled || (state.bg.imageEnabled && runtime.bgImageEl?.complete);
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

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : {r: 128, g: 128, b: 128};
}

export function drawBgGrid(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, forceLayer?: 'below' | 'above') {
  const state = getState().bg;
  if (!state.gridEnabled) return;
  const layer = forceLayer || state.gridLayer;
  if (!layer) return;
  ctx.save();
  const rgb = hexToRgb(state.gridColor || '#ffffff');
  const opacity = state.gridOpacity;
  const color = `rgba(${rgb.r},${rgb.g},${rgb.b},${opacity})`;
  const color2 = `rgba(${rgb.r},${rgb.g},${rgb.b},${Math.min(1, opacity + 0.15)})`;
  const px = state.gridPx || 25;
  const bigPx = px * 4;

  if (state.gridMode === 'line') {
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
        ctx.fillStyle = even
          ? `rgba(${rgb.r},${rgb.g},${rgb.b},${opacity})`
          : `rgba(${Math.max(0, rgb.r - 60)},${Math.max(0, rgb.g - 60)},${Math.max(0, rgb.b - 60)},${opacity})`;
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
    const state = getState().bg;
    if ('src' in img && typeof img.src === 'string' && img.src.includes('Backgrounds/Dressing') && CurrentScreen === 'Appearance') {
      const canvas = this.canvas;
      if (canvas?.width > 0 && canvas?.height > 0) {
        this.save();
        const hasBg = state.enabled || (state.imageEnabled && runtime.bgImageEl?.complete);
        if (!hasBg && !state.gridEnabled) {
          this.restore();
          return drawOriginal();
        }
        if (state.enabled) {
          this.fillStyle = state.color;
          this.fillRect(0, 0, canvas.width, canvas.height);
        }
        if (state.imageEnabled && runtime.bgImageEl?.complete) {
          originalDrawImage.call(this, runtime.bgImageEl, 0, 0, runtime.bgImageEl.width, runtime.bgImageEl.height, 0, 0, canvas.width, canvas.height);
        }
        if (!hasBg) drawOriginal();
        if (state.gridLayer === 'below') drawBgGrid(this, canvas, 'below');
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
  const state = getState().bg;
  if (!state.gridEnabled || state.gridLayer !== 'above' || CurrentScreen !== 'Appearance') return;
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
