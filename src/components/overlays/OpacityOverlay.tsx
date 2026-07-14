import type {AeeState} from '@/core/types';
import {getLayerOverride} from '@/core/bc';
import {t} from '@/i18n/i18n';
import {
  closeOpacityOverlay,
  moveOpacityOverlay,
  resetEditProperty,
  setOpacity,
  stepOpacity
} from '@/controllers/uiController';
import {clampPanelPosition, TOOL_PANEL_WIDTH} from '@/core/overlay';
import {FloatingPanel} from '@/components/FloatingPanel';
import {Button} from '@/components/ui/Button';
import {SliderRow} from '@/components/overlays/SliderRow';
import {getSelectedLayerLabel} from '@/components/overlays/getSelectedLayerLabel';

const OP_BASE_CX = 0.5;
const OP_BASE_CY = 0.97;
const OP_OFFSET_X = 300;
const OP_OFFSET_Y = -200;

export function OpacityOverlay({state}: { state: AeeState }) {
  if (!state.opacityOverlay.open || !state.canvasRect || !state.item || state.selectedLayer === null) return null;
  const layerOverride = getLayerOverride(state.item, state.selectedLayer);
  const value = Math.round((layerOverride.Opacity ?? 1) * 100);
  const defaultLeft = state.canvasRect.width * OP_BASE_CX + OP_OFFSET_X - TOOL_PANEL_WIDTH / 2;
  const defaultPos = clampPanelPosition(defaultLeft, state.canvasRect.height * OP_BASE_CY + OP_OFFSET_Y, state.canvasRect);
  const left = state.opacityOverlay.left ?? defaultPos.left;
  const top = state.opacityOverlay.top ?? defaultPos.top;
  const layerLabel = getSelectedLayerLabel(state);

  return <FloatingPanel
    canvasRect={state.canvasRect}
    left={left}
    top={top}
    title={t('opacity-overlay-title')}
    subtitle={layerLabel}
    onClose={closeOpacityOverlay}
    onMove={moveOpacityOverlay}
  >
    <SliderRow label="%" value={value} min={0} max={100} step={1} display={`${value}%`} inputValue={String(value)}
               onChange={next => setOpacity(state.selectedLayer!, next)}/>
    <div className="mt-1 flex items-center gap-1.5 border-t border-zinc-800 pt-2">
      <Button className="h-7 flex-1" onClick={() => stepOpacity(state.selectedLayer!, -1)}>-1</Button>
      <Button className="h-7 flex-1" onClick={() => stepOpacity(state.selectedLayer!, 1)}>+1</Button>
      <Button className="h-7" tone="danger" onClick={() => resetEditProperty('op')}>
        {t('opacity-overlay-reset-button')}
      </Button>
    </div>
  </FloatingPanel>;
}
