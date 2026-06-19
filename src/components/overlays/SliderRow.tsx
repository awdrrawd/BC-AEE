import {memo, useEffect, useRef} from 'react';
import {sliderRangeClass} from '@/components/overlays/styles';

export const SliderRow = memo(function SliderRow({label, value, min, max, step, display, inputValue, onChange}: {
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

  const inputRef = useRef<HTMLInputElement>(null);
  const rangeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = displayValue;
    }
    if (rangeRef.current && document.activeElement !== rangeRef.current) {
      rangeRef.current.value = String(rangeValue);
      rangeRef.current.style.background = `linear-gradient(to right, rgba(139,92,246,.95) ${pct}%, rgba(255,255,255,.16) ${pct}%)`;
    }
  }, [displayValue, rangeValue, pct]);

  const commitValue = (raw: string) => {
    const next = Number.parseFloat(raw);
    if (!Number.isNaN(next)) onChange(next);
  };

  return <div>
    <div className="mb-1 flex items-center justify-between gap-2">
      <span className="w-7 shrink-0 text-xs font-semibold text-zinc-300">{label}</span>
      <input
        ref={inputRef}
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
      ref={rangeRef}
      type="range"
      className={sliderRangeClass}
      min={min}
      max={max}
      step={step}
      defaultValue={rangeValue}
      style={{background: `linear-gradient(to right, rgba(139,92,246,.95) ${pct}%, rgba(255,255,255,.16) ${pct}%)`}}
      onChange={event => onChange(Number(event.target.value))}
      onPointerDown={event => event.stopPropagation()}
    />
  </div>;
}, (prev, next) => prev.value === next.value && prev.min === next.min && prev.max === next.max && prev.display === next.display && prev.inputValue === next.inputValue);
