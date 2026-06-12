import type {AeeState} from '@/core/types';
import {t} from '@/core/lang';
import {PARTS_PANEL_WIDTH} from '@/core/overlay';
import {movePartsPanel, togglePartsOpen} from '@/controllers/uiController';
import {FloatingPanel} from '@/components/FloatingPanel';
import {LayerList} from '@/components/layers/LayerList';

export function PartsFloat({state}: { state: AeeState }) {
  if (!state.partsOpen || !state.item || !state.canvasRect) return null;
  return <FloatingPanel
    canvasRect={state.canvasRect}
    left={state.partsLeft}
    top={state.partsTop}
    width={PARTS_PANEL_WIDTH}
    title={t('secPart')}
    onClose={() => togglePartsOpen(false)}
    onMove={movePartsPanel}
    className="max-h-64 min-h-20"
    bodyClassName="min-h-0 flex-1 overflow-y-auto p-1.5"
  >
    <LayerList item={state.item} layers={state.layers} selectedLayer={state.selectedLayer}/>
  </FloatingPanel>;
}
