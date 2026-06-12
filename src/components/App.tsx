import {useAeeStore} from '@/core/store';
import {MainPanel} from '@/components/MainPanel';
import {ColorPicker} from '@/components/ColorPicker';
import {ViewControls} from '@/components/ViewControls';
import {ImportDialog} from '@/components/ImportDialog';
import {OpacityOverlay} from '@/components/overlays/OpacityOverlay';
import {RotationOverlay} from '@/components/overlays/RotationOverlay';
import {TransformOverlay} from '@/components/overlays/TransformOverlay';

export function App() {
  const state = useAeeStore();
  return <>
    <MainPanel state={state}/>
    <TransformOverlay state={state}/>
    <OpacityOverlay state={state}/>
    <RotationOverlay state={state}/>
    <ColorPicker state={state}/>
    <ViewControls state={state}/>
    <ImportDialog state={state}/>
  </>;
}
