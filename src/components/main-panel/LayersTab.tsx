import type {AeeState} from '../../core/types';
import {getLayerDisplayName} from '../../core/bc';
import {t} from '../../core/lang';
import {PriorityRow} from './PriorityRow';

export function LayersTab({state}: {state: AeeState}) {
  if (!state.layers.length) return <div className="p-6 text-center text-sm text-zinc-500">{t('noLayers')}</div>;
  return <>
    <PriorityRow item={state.item} layerId="all" name={<strong>{t('allParts')}</strong>}/>
    {state.layers.map((layer, index) =>
      <PriorityRow key={`${layer.Name}-${index}`} item={state.item} layerId={String(index)} name={getLayerDisplayName(layer, index)}/>
    )}
  </>;
}
