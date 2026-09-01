import type {AeeState} from '@/core/types';
import {t} from '@/i18n/i18n';
import {PARTS_PANEL_WIDTH} from '@/core/overlay';
import {movePartsPanel, togglePartsOpen} from '@/controllers/uiController';
import {FloatingPanel} from '@/components/FloatingPanel';
import {LayerList} from '@/components/layers/LayerList';
import {FolderSearch} from 'lucide-react';

export function PartsFloat({state}: { state: AeeState }) {
  if (!state.partsOpen || !state.item || !state.canvasRect) return null;
  return <FloatingPanel
    canvasRect={state.canvasRect}
    left={state.partsLeft}
    top={state.partsTop}
    width={PARTS_PANEL_WIDTH}
    title={t('parts-float-title')}
    headerActions={<button type="button" aria-label={t('parts-browser-title')} data-aee-tooltip={t('parts-browser-title')}
      className="flex h-[30px] w-[45px] items-center justify-center rounded border border-zinc-700 bg-(--aee-control-bg) text-zinc-200 hover:border-(--aee-accent)"
      onPointerDown={event => event.stopPropagation()} onClick={() => window.dispatchEvent(new Event('aee-toggle-parts-browser'))}>
      <FolderSearch className="h-[25px] w-[25px]"/>
    </button>}
    onClose={() => togglePartsOpen(false)}
    onMove={movePartsPanel}
    className="max-h-[512px] min-h-[160px]"
    bodyClassName="aee-scroll min-h-0 flex-1 overflow-y-auto p-1.5"
  >
    <LayerList item={state.item} selectedLayer={state.selectedLayer}/>
  </FloatingPanel>;
}
