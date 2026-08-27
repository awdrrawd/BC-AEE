import {useHoldRepeat} from '@/components/ui/useHoldRepeat';

export function StepPair({display, onStep, onReset}: { display: string; onStep: (delta: number) => void; onReset?: () => void }) {
  const dec = useHoldRepeat(() => onStep(-1));
  const inc = useHoldRepeat(() => onStep(1));
  return <div className="flex items-center gap-1">
    <button className="h-5 rounded border border-zinc-700 px-1.5 text-[11px] hover:border-(--aee-accent) hover:bg-(--aee-accent-65)" {...dec}>−1</button>
    <span className="min-w-8 shrink-0 text-center font-mono text-xs tabular-nums text-teal-300">{display}</span>
    <button className="h-5 rounded border border-zinc-700 px-1.5 text-[11px] hover:border-(--aee-accent) hover:bg-(--aee-accent-65)" {...inc}>+1</button>
    {onReset ? <button className="h-5 rounded border border-zinc-700 px-1.5 text-[11px] text-zinc-400 hover:border-red-300 hover:text-red-200" onClick={onReset}>↺</button> : null}
  </div>;
}
