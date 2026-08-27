import type {DragMode} from '@/core/types';
import {setActiveDrag} from '@/controllers/uiController';

export function DragCheck({mode, label, activeDrag}: {
  mode: Exclude<DragMode, null>;
  label: string;
  activeDrag: DragMode
}) {
  const active = activeDrag === mode;
  return <button
    onClick={() => setActiveDrag(mode)}
    className={`h-5 rounded border px-1.5 text-[11px] transition ${active ? 'border-teal-300 text-teal-300' : 'border-zinc-700 text-zinc-400 hover:border-teal-300 hover:text-teal-300'}`}>
    {label}
  </button>;
}
