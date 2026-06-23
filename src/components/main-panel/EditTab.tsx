import type {AeeState} from '@/core/types';
import {t} from '@/i18n/i18n';
import {LayerList} from '@/components/layers/LayerList';
import {EditSection} from '@/components/main-panel/EditSection';
import {Section} from '@/components/main-panel/Section';

export function EditTab({state}: { state: AeeState }) {
  return <>
    {state.selectedLayer !== null ? <EditSection state={state} layerId={state.selectedLayer}/> : null}
    <Section title={t('edit-tab-parts-section-title')}>
      <LayerList item={state.item} selectedLayer={state.selectedLayer}/>
    </Section>
  </>;
}
