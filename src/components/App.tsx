import {useAeeStore} from '@/core/store';
import {MainPanel} from '@/components/MainPanel';
import {ColorPicker} from '@/components/ColorPicker';
import {ViewControls} from '@/components/ViewControls';
import {ImportDialog} from '@/components/ImportDialog';
import {OpacityOverlay} from '@/components/overlays/OpacityOverlay';
import {RotationOverlay} from '@/components/overlays/RotationOverlay';
import {TransformOverlay} from '@/components/overlays/TransformOverlay';
import {WardrobeScreen} from '@/components/wardrobe/WardrobeScreen';
import {useWardrobeStore} from '@/core/wardrobeStore';
import {usePrompt} from '@/core/prompts';
import {PromptDialog} from '@/components/ui/PromptDialog';
import {ItemFontPanelHost} from '@/components/main-panel/ItemFontPanel';
import {uiThemeVariables} from '@/core/theme';

export function App() {
  const state = useAeeStore();
  const wardrobe = useWardrobeStore();
  const prompt = usePrompt();
  return <div className="contents" style={uiThemeVariables(wardrobe.theme)}>
    <WardrobeScreen state={wardrobe}/>
    <MainPanel state={state}/>
    <TransformOverlay state={state}/>
    <OpacityOverlay state={state}/>
    <RotationOverlay state={state}/>
    <ColorPicker state={state}/>
    <ViewControls state={state}/>
    <ImportDialog state={state}/>
    <ItemFontPanelHost canvasRect={state.canvasRect}/>
    {prompt && !wardrobe.active
      ? <div className="fixed inset-0 z-1000005"><PromptDialog prompt={prompt} scale="panel"/></div>
      : null}
  </div>;
}
