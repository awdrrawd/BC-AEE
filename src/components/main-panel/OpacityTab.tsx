import type {AeeState} from '@/core/types';
import {getEditableParts, getOpacity} from '@/core/bc';
import {t} from '@/i18n/i18n';
import {readOpacityPct} from '@/controllers/uiController';
import {OpacityRow} from '@/components/main-panel/OpacityRow';

export function OpacityTab({state}: { state: AeeState }) {
  const item = state.item;
  const allOpacity = getOpacity(item, 'all');
  const allDisplay = allOpacity === null ? '—' : `${Math.round(allOpacity * 100)}%`;
  const allValue = allOpacity === null ? 100 : Math.round(allOpacity * 100);
  return <>
    <OpacityRow layerId="all" name={t('opacity-tab-all-parts-row')} value={allValue} display={allDisplay}/>
    {getEditableParts(item).map(part => {
      const value = readOpacityPct(item, part.layerId) ?? 100;
      return <OpacityRow key={part.layerId} layerId={part.layerId} name={part.name}
                         value={value} display={`${value}%`}/>;
    })}
  </>;
}
