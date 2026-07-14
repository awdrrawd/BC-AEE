import type {ReactNode} from 'react';
import type {LayerId} from '@/core/types';
import {getPriorityValue, resetPriority, setPriority, stepPriority} from '@/controllers/uiController';
import {RangeInput} from '@/components/main-panel/RangeInput';

export function PriorityRow({item, layerId, name}: { item: Item; layerId: LayerId; name: ReactNode }) {
  const priority = getPriorityValue(item, layerId);
  return <div className="border-b border-zinc-700 px-2.5 py-2">
    <div className="mb-1 flex items-center justify-between gap-2">
      <span
        className={`min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm ${priority.overridden ? 'text-teal-300' : 'text-zinc-100'}`}>
        {name}<span className="ml-1 text-[10px] text-zinc-500">({priority.base})</span>
      </span>
      <div className="flex items-center gap-1">
        <button
          className="h-5 rounded border border-zinc-700 px-1.5 text-[11px] hover:border-[var(--aee-accent)] hover:bg-[var(--aee-accent-65)]"
          onClick={() => stepPriority(layerId, -1)}>−1
        </button>
        <span className="min-w-8 text-center font-mono text-xs text-teal-300">{priority.current}</span>
        <button
          className="h-5 rounded border border-zinc-700 px-1.5 text-[11px] hover:border-[var(--aee-accent)] hover:bg-[var(--aee-accent-65)]"
          onClick={() => stepPriority(layerId, 1)}>+1
        </button>
        <button
          className="h-5 rounded border border-zinc-700 px-1.5 text-[11px] text-zinc-400 hover:border-red-300 hover:text-red-200"
          onClick={() => resetPriority(layerId)}>↺
        </button>
      </div>
    </div>
    <div className="relative flex items-center">
      <RangeInput min={-99} max={99} step={1} value={priority.current} onChange={next => setPriority(layerId, next)}/>
      <span
        className="pointer-events-none absolute left-1/2 top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-[var(--aee-accent-55)]"/>
    </div>
  </div>;
}
