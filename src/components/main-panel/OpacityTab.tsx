import type {AeeState} from '@/core/types';
import {getLayerDisplayName, getOpacity} from '@/core/bc';
import {t} from '@/core/lang';
import {readOpacityPct} from '@/controllers/uiController';
import {OpacityRow} from '@/components/main-panel/OpacityRow';

export function OpacityTab({state}: { state: AeeState }) {
  const item = state.item;
  const allOpacity = getOpacity(item, 'all');
  const allDisplay = allOpacity === null ? '—' : `${Math.round(allOpacity * 100)}%`;
  const allValue = allOpacity === null ? 100 : Math.round(allOpacity * 100);
  return <>
    <OpacityRow layerId="all" name={t('allParts')} value={allValue} display={allDisplay}/>
    {state.layers.map((layer, index) => {
      const value = readOpacityPct(item, String(index)) ?? 100;
      return <OpacityRow key={`${layer.Name}-${index}`} layerId={String(index)} name={getLayerDisplayName(layer, index)}
                         value={value} display={`${value}%`}/>;
    })}
  </>;
}
