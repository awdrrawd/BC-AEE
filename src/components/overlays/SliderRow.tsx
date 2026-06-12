import {sliderRangeClass} from '@/components/overlays/styles';

export function SliderRow({label, value, min, max, step, display, inputValue, onChange}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  inputValue?: string;
  onChange: (value: number) => void
}) {
  const rangeValue = Math.max(min, Math.min(max, value));
  const pct = max === min ? 0 : ((rangeValue - min) / (max - min)) * 100;
  const displayValue = inputValue ?? display.replace(/[°%]/g, '');
  const commitValue = (raw: string) => {
    const next = Number.parseFloat(raw);
    if (!Number.isNaN(next)) onChange(next);
  };

  return <div>
    <div className="mb-1 flex items-center justify-between gap-2">
      <span className="w-7 shrink-0 text-xs font-semibold text-zinc-300">{label}</span>
      <input
        key={displayValue}
        type="text"
        className="h-6 w-16 rounded border border-zinc-800 bg-zinc-900 px-1 text-right font-mono text-xs text-teal-300 outline-none focus:border-teal-300"
        defaultValue={displayValue}
        onBlur={event => commitValue(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            commitValue((event.target as HTMLInputElement).value);
            (event.target as HTMLInputElement).blur();
          } else if (event.key === 'Escape') {
            (event.target as HTMLInputElement).value = displayValue;
            (event.target as HTMLInputElement).blur();
          }
        }}
        onPointerDown={event => event.stopPropagation()}
      />
    </div>
    <input
      type="range"
      className={sliderRangeClass}
      min={min}
      max={max}
      step={step}
      value={rangeValue}
      style={{background: `linear-gradient(to right, rgba(139,92,246,.95) ${pct}%, rgba(255,255,255,.16) ${pct}%)`}}
      onChange={event => onChange(Number(event.target.value))}
      onPointerDown={event => event.stopPropagation()}
    />
  </div>;
}
