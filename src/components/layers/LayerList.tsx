import type {LayerId} from '@/core/types';
import {getLayerColor, getLayerDisplayName} from '@/core/bc';
import {t} from '@/i18n/i18n';
import {LayerButtonRow} from '@/components/layers/LayerButtonRow';

export function LayerList({item, layers, selectedLayer}: {
  item: Item | null;
  layers: readonly AssetLayer[];
  selectedLayer: LayerId | null
}) {
  return <div>
    <LayerButtonRow id="all" name={t('layer-list-all-parts-row')} color={getLayerColor(item, 'all')}
                    selected={selectedLayer === 'all'}/>
    {layers.map((layer, index) =>
      <LayerButtonRow
        key={`${layer.Name}-${index}`}
        id={String(index)}
        name={getLayerDisplayName(layer, index)}
        color={getLayerColor(item, String(index))}
        selected={selectedLayer === String(index)}
      />
    )}
  </div>;
}
