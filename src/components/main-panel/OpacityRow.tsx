import type {LayerId} from '@/core/types';
import {resetEditProperty, setOpacity, stepOpacity} from '@/controllers/uiController';
import {RangeInput} from '@/components/main-panel/RangeInput';
import {tallRangeClass} from '@/components/main-panel/styles';
import {useHoldRepeat} from '@/components/ui/useHoldRepeat';

export function OpacityRow({layerId, name, value, display}: {
  layerId: LayerId;
  name: string;
  value: number;
  display: string
}) {
  const dec = useHoldRepeat(() => stepOpacity(layerId, -1));
  const inc = useHoldRepeat(() => stepOpacity(layerId, 1));
  return <div className="border-b border-zinc-700 px-2.5 py-2">
    <div className="mb-1 flex items-center justify-between gap-2">
      <span
        className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-zinc-100">{name}</span>
      <div className="flex items-center gap-1">
        <button className="h-5 rounded border border-zinc-700 px-1.5 text-[11px] hover:border-(--aee-accent) hover:bg-(--aee-accent-65)" {...dec}>−1</button>
        <span className="min-w-8 text-center font-mono text-xs text-teal-300">{display}</span>
        <button className="h-5 rounded border border-zinc-700 px-1.5 text-[11px] hover:border-(--aee-accent) hover:bg-(--aee-accent-65)" {...inc}>+1</button>
        <button className="h-5 rounded border border-zinc-700 px-1.5 text-[11px] text-zinc-400 hover:border-red-300 hover:text-red-200" onClick={() => resetEditProperty('op')}>↺</button>
      </div>
    </div>
    <div className="relative flex items-center">
      <RangeInput className={tallRangeClass} min={0} max={100} step={1} value={value} onChange={next => setOpacity(layerId, next)}/>
      <span className="pointer-events-none absolute left-1/2 top-1/2 h-[19px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded bg-(--aee-accent)"/>
    </div>
  </div>;
}
