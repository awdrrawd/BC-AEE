import type {DragMode} from '@/core/types';
import {setActiveDrag} from '@/controllers/uiController';
import {Switch} from '@/components/Switch';

export function DragCheck({mode, label, activeDrag}: {
  mode: Exclude<DragMode, null>;
  label: string;
  activeDrag: DragMode
}) {
  const active = activeDrag === mode;
  return <Switch checked={active} onChange={() => setActiveDrag(mode)} ariaLabel={label}
                 className={`gap-1 rounded border px-1.5 py-0.5 text-xs transition ${active ? 'border-teal-300 bg-teal-400/10 text-teal-300' : 'border-zinc-700 text-zinc-400 hover:border-teal-300 hover:text-teal-300'}`}>
    {label}
  </Switch>;
}
