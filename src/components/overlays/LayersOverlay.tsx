import type {AeeState} from '@/core/types';
import {FloatingPanel} from '@/components/FloatingPanel';
import {PriorityRow} from '@/components/main-panel/PriorityRow';
import {getSelectedLayerLabel} from '@/components/overlays/getSelectedLayerLabel';
import {clampPanelPosition, TOOL_PANEL_WIDTH} from '@/core/overlay';
import {closeLayersOverlay, moveLayersOverlay} from '@/controllers/uiController';
import {t} from '@/i18n/i18n';

export function LayersOverlay({state}: {state: AeeState}) {
  if (!state.layersOverlay.open || state.toolbarLayout !== 'free' || !state.canvasRect || !state.item || state.selectedLayer === null) return null;
  const defaultLeft = state.canvasRect.width * .5 + 300 - TOOL_PANEL_WIDTH / 2;
  const defaultPos = clampPanelPosition(defaultLeft, state.canvasRect.height * .97 - 200, state.canvasRect);
  return <FloatingPanel canvasRect={state.canvasRect}
    left={state.layersOverlay.left ?? defaultPos.left} top={state.layersOverlay.top ?? defaultPos.top}
    title={t('main-panel-tab-layers')} subtitle={getSelectedLayerLabel(state)}
    onClose={closeLayersOverlay} onMove={moveLayersOverlay} bodyClassName="p-0">
    <PriorityRow item={state.item} layerId={state.selectedLayer} name={getSelectedLayerLabel(state)}/>
  </FloatingPanel>;
}
