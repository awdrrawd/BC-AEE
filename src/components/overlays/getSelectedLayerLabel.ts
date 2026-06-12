import type {AeeState} from '@/core/types';
import {getLayerDisplayName} from '@/core/bc';
import {t} from '@/i18n/i18n';

export function getSelectedLayerLabel(state: AeeState) {
  if (state.selectedLayer === 'all') return t('selected-layer-label-all-parts');
  const layerIndex = state.selectedLayer === null ? null : parseInt(state.selectedLayer, 10);
  return getLayerDisplayName(layerIndex === null ? null : state.layers[layerIndex], state.selectedLayer ?? 0);
}
