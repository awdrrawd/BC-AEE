import bcAeeModSdk from '../modsdk';
import {runtime} from '../core/runtime';
import {getState} from '../core/store';
import {syncCurrentContext} from '../core/context';
import {getCanvasRect, getLayerDisplayName, getLayerColor} from '../core/bc';
import {observeAppearanceScreenState, updateAppearanceScreenState} from '../core/appearanceScreenMachine';
import {closeColorPicker, openColorPicker, setColorPickerValue, startHoverHighlight, stopHoverHighlight} from '../controllers/uiController';

export function installItemColorHooks() {
  bcAeeModSdk.hookFunction('ItemColorDraw', 0, (args, next) => {
    if (args[0]) runtime.itemColorChar = args[0];
    if (args[0] && args[1]) runtime.itemColorItem = InventoryGet(args[0], args[1]);
    handleItemColorHover();
    return next(args);
  });

  bcAeeModSdk.hookFunction('ItemColorLoad', 0, (args, next) => {
    runtime.itemColorChar = args[0];
    runtime.itemColorItem = args[1];
    runtime.itemColorDirty = false;
    const result = observeAppearanceScreenState(next(args));
    syncCurrentContext();
    Promise.resolve(result).then(() => {
      updateAppearanceScreenState();
      window.setTimeout(syncCurrentContext, 300);
    });
    return result;
  });

  bcAeeModSdk.hookFunction('ItemColorOpenPicker', 0, (args, next) => {
    const item = typeof ItemColorItem !== 'undefined' ? ItemColorItem : runtime.itemColorItem;
    const indices = typeof ItemColorPickerIndices !== 'undefined' ? [...ItemColorPickerIndices] : null;
    const pickerLayers = typeof ItemColorPickerLayers !== 'undefined' ? [...ItemColorPickerLayers.values()] : null;
    runtime.pickerContext = {item, indices, pickerLayers};
    return observeAppearanceScreenState(next(args));
  });

  bcAeeModSdk.hookFunction('ItemColorCloseColorPicker', 0, (args, next) => {
    return observeAppearanceScreenState(next(args));
  });

  bcAeeModSdk.hookFunction('ColorPickerUnload', 0, (args, next) => {
    closeAeeBcColorPicker();
    return next(args);
  });

  bcAeeModSdk.hookFunction('ItemColorFireExit', 0, (args, next) => {
    const dirtyChar = runtime.itemColorChar;
    let result;
    try {
      result = next(args);
    } catch (error: unknown) {
      console.warn('[AEE] ItemColorFireExit chain error (suppressed):',
        error instanceof Error ? error.message : String(error));
      result = undefined;
    } finally {
      runtime.itemColorChar = null;
      runtime.itemColorItem = null;
      runtime.itemColorDirty = false;
      closeAeeBcColorPicker();
      updateAppearanceScreenState();
    }
    if (args[0] === true && dirtyChar) {
      try {
        ChatRoomCharacterUpdate(dirtyChar);
      } catch {
        // Ignore failed chat-room sync while leaving the color picker.
      }
    }
    syncCurrentContext();
    updateAppearanceScreenState();
    return result;
  });

  bcAeeModSdk.hookFunction('ColorPickerInit', 0, async (args, next) => {
    if (!getState().useAeeColorPicker) return await next(args);
    if (args[0]?.dispatch === false) return await next(args);

    const result = await next(args);
    const main = document.getElementById('color-picker-main');
    if (!main) return result;
    const originalFieldset = main.querySelector('fieldset[name="color-picker"]') as HTMLElement | null;
    if (!originalFieldset) return result;
    originalFieldset.style.display = 'none';

    const bcItem = (typeof ItemColorItem !== 'undefined' ? ItemColorItem : null) || runtime.itemColorItem;
    const selectedLayer = getState().selectedLayer ?? 'all';
    const hexInput = main.querySelector('input[name="output"]') as HTMLInputElement | null;
    const domHex6 = hexInput?.value?.match(/^#[0-9a-fA-F]{6}$/) ? hexInput.value
      : hexInput?.value?.match(/^#[0-9a-fA-F]{8}$/) ? hexInput.value.slice(0, 7) : null;
    const cachedHex = domHex6 || (bcItem ? getLayerColor(bcItem, selectedLayer) : null) || '#FFFFFF';

    const h1 = document.getElementById('color-picker-h1');
    const fullName = h1?.querySelector('q')?.textContent;
    const layerName = fullName?.includes('/') ? fullName.split('/').pop() : fullName;
    let pickerLayerIdx = -1;
    if (layerName && runtime.pickerContext?.item) {
      const layers = runtime.pickerContext.item.Asset?.Layer;
      pickerLayerIdx = layers?.findIndex((layer: AssetLayer, index: number) =>
        getLayerDisplayName(layer, index) === layerName || layer.Name === layerName || layerName.includes(layer.Name)
      ) ?? -1;
    }

    let currentOpacityPct = 100;
    if (hexInput?.value?.match(/^#[0-9a-fA-F]{8}$/)) {
      currentOpacityPct = Math.round(parseInt(hexInput.value.slice(7, 9), 16) / 255 * 100);
    } else if (runtime.pickerContext?.indices?.length === 1 && runtime.pickerContext?.item) {
      const layerIndex = pickerLayerIdx >= 0 ? pickerLayerIdx : runtime.pickerContext.indices[0];
      const opacity = runtime.pickerContext.item.Property?.Opacity?.[layerIndex + 1] ?? runtime.pickerContext.item.Property?.Opacity?.[layerIndex];
      if (opacity !== undefined) currentOpacityPct = Math.round(opacity * 100);
    }

    openColorPicker(cachedHex, hex => {
      const cpRoot = document.getElementById('color-picker');
      if (!cpRoot) return;
      const opInput = cpRoot.querySelector('input[name="opacity"]') as HTMLInputElement | null;
      const outputInput = cpRoot.querySelector('input[name="output"]') as HTMLInputElement | null;
      if (outputInput) {
        outputInput.value = hex;
        outputInput.dispatchEvent(new Event('input', {bubbles: true}));
        outputInput.dispatchEvent(new Event('change', {bubbles: true}));
      }
      if (opInput) {
        opInput.value = String(runtime.colorPickerAlpha ?? 255);
        opInput.dispatchEvent(new Event('input', {bubbles: true}));
        opInput.dispatchEvent(new Event('change', {bubbles: true}));
      }
    }, true, currentOpacityPct);
    setColorPickerValue(cachedHex, currentOpacityPct);
    return result;
  });
}

function handleItemColorHover() {
  const state = getState();
  if (!state.visible || !(state.hoverHighlight || state.hoverHighlightChar)) return;
  const item = runtime.itemColorItem;
  if (!item) return;
  let foundIdx: string | null = null;
  const rect = getCanvasRect();
  if (rect && typeof MouseX !== 'undefined' && typeof MouseY !== 'undefined') {
    const canvas = document.getElementById('MainCanvas') as HTMLCanvasElement | null;
    const clientX = rect.left + (MouseX / (canvas?.width || 2000)) * rect.width;
    const clientY = rect.top + (MouseY / (canvas?.height || 1000)) * rect.height;
    document.querySelectorAll('[data-aee-layer-button]').forEach(button => {
      const buttonRect = button.getBoundingClientRect();
      if (clientX >= buttonRect.left && clientX <= buttonRect.right && clientY >= buttonRect.top && clientY <= buttonRect.bottom) {
        foundIdx = (button as HTMLElement).dataset.selectLayer ?? null;
      }
    });
  }

  const layeringOpen = !!document.getElementById('layering');
  if (Date.now() < runtime.hoverCooldownUntil || layeringOpen) {
    if (runtime.hoverLayerIdx !== null) {
      stopHoverHighlight(true);
      runtime.hoverLayerIdx = null;
    }
  } else if (foundIdx !== runtime.hoverLayerIdx) {
    if (runtime.hoverLayerIdx !== null) stopHoverHighlight(true);
    runtime.hoverLayerIdx = foundIdx;
    if (foundIdx !== null) startHoverHighlight(item, foundIdx);
  }
}

function closeAeeBcColorPicker() {
  if (!getState().colorPicker.open) return;
  closeColorPicker(true);
  const main = document.getElementById('color-picker-main');
  const originalFieldset = main?.querySelector('fieldset[name="color-picker"]') as HTMLElement | null;
  if (originalFieldset) originalFieldset.style.display = '';
}
