import type {AeeState} from '@/core/types';
import {BgSettingsPanel} from '@/components/view-controls/BgSettingsPanel';
import {OffsetPanel} from '@/components/view-controls/OffsetPanel';
import {PoseWindow} from '@/components/view-controls/PoseWindow';

export function ViewControls({state}: { state: AeeState }) {
  if (!state.canvasRect) return null;
  return <>
    <OffsetPanel state={state}/>
    <BgSettingsPanel state={state}/>
    <PoseWindow state={state}/>
  </>;
}
