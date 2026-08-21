import type {LayerId} from '@/core/types';
import {setOpacity, stepOpacity} from '@/controllers/uiController';
import {RangeInput} from '@/components/main-panel/RangeInput';
import {StepPair} from '@/components/main-panel/StepPair';
import {tallRangeClass} from '@/components/main-panel/styles';

export function OpacityRow({layerId, name, value, display}: {
  layerId: LayerId;
  name: string;
  value: number;
  display: string
}) {
  return <div className="border-b border-zinc-700 px-2.5 py-2">
    <div className="mb-1 flex items-center justify-between gap-2">
      <span
        className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-zinc-100">{name}</span>
      <StepPair display={display} onStep={delta => stepOpacity(layerId, delta)}/>
    </div>
    <div className="relative flex items-center">
      <RangeInput className={tallRangeClass} min={0} max={100} step={1} value={value} onChange={next => setOpacity(layerId, next)}/>
      <span className="pointer-events-none absolute left-1/2 top-1/2 h-[19px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded bg-(--aee-accent)"/>
    </div>
  </div>;
}
