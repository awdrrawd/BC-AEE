import type {AeeState} from '@/core/types';
import {getEditableParts} from '@/core/bc';
import {t} from '@/i18n/i18n';
import {PriorityRow} from '@/components/main-panel/PriorityRow';

export function LayersTab({state}: { state: AeeState }) {
  if (!state.layers.length) return <div className="p-6 text-center text-sm text-zinc-500">{t('layers-tab-empty-message')}</div>;
  return <>
    <PriorityRow item={state.item} layerId="all" name={<strong>{t('layers-tab-all-parts-row')}</strong>}/>
    {getEditableParts(state.item).map(part =>
      <PriorityRow key={part.layerId} item={state.item} layerId={part.layerId} name={part.name}/>
    )}
  </>;
}
