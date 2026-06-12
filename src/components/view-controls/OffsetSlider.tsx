export function OffsetSlider({label, min, max, step, value, display, onChange, onReset}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  onChange: (value: number) => void;
  onReset: () => void
}) {
  return <div className="flex items-center gap-1.5">
    <span className="w-9 shrink-0 text-[11px] text-zinc-400">{label}</span>
    <input type="range" className="h-1 flex-1 cursor-pointer appearance-none rounded bg-zinc-800 accent-violet-500"
           min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))}/>
    <span className="min-w-9 text-right font-mono text-[11px] text-violet-300">{display}</span>
    <button
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-zinc-700 text-[11px] text-zinc-400 hover:border-red-300 hover:text-red-200"
      onClick={onReset}>↺
    </button>
  </div>;
}
