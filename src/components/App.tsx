import {useAeeStore} from '../core/store';
import {MainPanel} from './MainPanel';
import {ColorPicker} from './ColorPicker';
import {OpacityOverlay, RotationOverlay} from './Overlays';
import {ViewControls} from './ViewControls';
import {ImportDialog} from './ImportDialog';

export function App() {
  const state = useAeeStore();
  return <>
    <MainPanel state={state}/>
    <OpacityOverlay state={state}/>
    <RotationOverlay state={state}/>
    <ColorPicker state={state}/>
    <ViewControls state={state}/>
    <ImportDialog state={state}/>
  </>;
}
