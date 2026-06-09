import type {AeeState} from '../../core/types';
import {t} from '../../core/lang';
import {LayerList} from '../layers/LayerList';
import {EditSection} from './EditSection';
import {Section} from './Section';

export function EditTab({state}: {state: AeeState}) {
  return <>
    {state.selectedLayer !== null ? <EditSection state={state} layerId={state.selectedLayer}/> : null}
    <Section title={t('secPart')}>
      <LayerList item={state.item} layers={state.layers} selectedLayer={state.selectedLayer}/>
    </Section>
  </>;
}
