import type {LayerId} from '@/core/types';
import {getEditableParts, getLayerColor} from '@/core/bc';
import {t} from '@/i18n/i18n';
import {LayerButtonRow} from '@/components/layers/LayerButtonRow';

export function LayerList({item, selectedLayer}: {
  item: Item | null;
  selectedLayer: LayerId | null
}) {
  return <div>
    <LayerButtonRow id="all" name={t('layer-list-all-parts-row')} color={getLayerColor(item, 'all')}
                    selected={selectedLayer === 'all'}/>
    {getEditableParts(item).map(part =>
      <LayerButtonRow
        key={part.layerId}
        id={part.layerId}
        name={part.name}
        color={getLayerColor(item, part.layerId)}
        selected={selectedLayer === part.layerId}
      />
    )}
  </div>;
}
