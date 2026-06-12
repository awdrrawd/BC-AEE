import type {AeeState} from '@/core/types';
import {BgSettingsPanel} from '@/components/view-controls/BgSettingsPanel';
import {CharControl} from '@/components/view-controls/CharControl';
import {OffsetPanel} from '@/components/view-controls/OffsetPanel';
import {PoseWindow} from '@/components/view-controls/PoseWindow';

export function ViewControls({state}: { state: AeeState }) {
  if (!state.charControl.visible || !state.canvasRect) return null;
  return <>
    <CharControl state={state}/>
    <OffsetPanel state={state}/>
    <BgSettingsPanel state={state}/>
    <PoseWindow state={state}/>
  </>;
}
