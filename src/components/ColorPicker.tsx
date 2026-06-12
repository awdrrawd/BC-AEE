import type {AeeState} from '@/core/types';
import {ColorPickerPanel} from '@/components/color-picker/ColorPickerPanel';

export function ColorPicker({state}: { state: AeeState }) {
  if (!state.colorPicker.open) return null;
  return <ColorPickerPanel key={state.colorPicker.sessionId} state={state}/>;
}
