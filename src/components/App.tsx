import {useAeeStore} from '../core/store';
import {MainPanel} from './MainPanel';
import {ColorPicker} from './ColorPicker';
import {ViewControls} from './ViewControls';
import {ImportDialog} from './ImportDialog';
import {OpacityOverlay} from './overlays/OpacityOverlay';
import {RotationOverlay} from './overlays/RotationOverlay';
import {TransformOverlay} from './overlays/TransformOverlay';

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
