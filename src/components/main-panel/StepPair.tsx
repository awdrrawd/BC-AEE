export function StepPair({display, onStep}: {display: string; onStep: (delta: number) => void}) {
  return <div className="flex items-center gap-1">
    <button className="h-5 rounded border border-zinc-700 px-1.5 text-[11px] hover:border-violet-400 hover:bg-violet-600" onClick={() => onStep(-1)}>−1</button>
    <span className="min-w-9 text-center font-mono text-xs text-teal-300">{display}</span>
    <button className="h-5 rounded border border-zinc-700 px-1.5 text-[11px] hover:border-violet-400 hover:bg-violet-600" onClick={() => onStep(1)}>+1</button>
  </div>;
}
