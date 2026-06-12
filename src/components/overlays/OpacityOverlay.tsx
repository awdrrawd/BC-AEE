import type {AeeState} from '@/core/types';
import {getLayerOverride} from '@/core/bc';
import {isZh, t} from '@/core/lang';
import {
  closeOpacityOverlay,
  moveOpacityOverlay,
  resetEditProperty,
  setOpacity,
  stepOpacity
} from '@/controllers/uiController';
import {clampPanelPosition, TOOL_PANEL_WIDTH} from '@/core/overlay';
import {FloatingPanel} from '@/components/FloatingPanel';
import {PanelButton} from '@/components/overlays/PanelButton';
import {SliderRow} from '@/components/overlays/SliderRow';
import {getSelectedLayerLabel} from '@/components/overlays/getSelectedLayerLabel';
import {OP_BASE_CX, OP_BASE_CY, OP_OFFSET_X, OP_OFFSET_Y} from '@/components/overlays/styles';

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
    title={t('opacity')}
    subtitle={layerLabel}
    onClose={closeOpacityOverlay}
    onMove={moveOpacityOverlay}
  >
    <SliderRow label="%" value={value} min={0} max={100} step={1} display={`${value}%`} inputValue={String(value)}
               onChange={next => setOpacity(state.selectedLayer!, next)}/>
    <div className="mt-1 flex items-center gap-1.5 border-t border-zinc-800 pt-2">
      <PanelButton className="flex-1" onClick={() => stepOpacity(state.selectedLayer!, -1)}>-1</PanelButton>
      <PanelButton className="flex-1" onClick={() => stepOpacity(state.selectedLayer!, 1)}>+1</PanelButton>
      <PanelButton tone="danger" onClick={() => resetEditProperty('op')}>
        {isZh() ? '重置' : 'Reset'}
      </PanelButton>
    </div>
  </FloatingPanel>;
}
