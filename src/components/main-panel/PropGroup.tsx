import type {ReactNode} from 'react';
import type {DragMode} from '../../core/types';
import {DragCheck} from './DragCheck';

export function PropGroup({title, dragMode, dragLabel, activeDrag, children}: {title: string; dragMode: Exclude<DragMode, null>; dragLabel: string; activeDrag: DragMode; children: ReactNode}) {
  return <div className="mb-2">
    <div className="mb-1 flex items-center justify-between gap-2">
      <span className="text-xs font-bold tracking-wide text-zinc-100">{title}</span>
      <DragCheck mode={dragMode} label={dragLabel} activeDrag={activeDrag}/>
    </div>
    {children}
  </div>;
}
