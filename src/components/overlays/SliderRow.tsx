import {memo, useEffect, useRef} from 'react';
import {clamp} from '@/util/math';
import {HoldButton} from '@/components/ui/HoldButton';
import {resetButtonClass, stepButtonClass, tallRangeClass} from '@/components/main-panel/styles';

export const SliderRow = memo(function SliderRow({label, value, min, max, step, display, inputValue, stepDelta = step, onChange, onReset}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  inputValue?: string;
  stepDelta?: number;
  onChange: (value: number) => void
  onReset?: () => void;
}) {
  const rangeValue = clamp(value, min, max);
  const displayValue = inputValue ?? display.replace(/[°%]/g, '');

  const inputRef = useRef<HTMLInputElement>(null);
  const rangeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = displayValue;
    }
    if (rangeRef.current && document.activeElement !== rangeRef.current) {
      rangeRef.current.value = String(rangeValue);
    }
  }, [displayValue, rangeValue]);

  const commitValue = (raw: string) => {
    const next = Number.parseFloat(raw);
    if (!Number.isNaN(next)) onChange(next);
  };

  return <div>
    <div className="mb-1 flex items-center justify-between gap-2">
      <span className="w-7 shrink-0 text-xs font-semibold text-zinc-300">{label}</span>
      <div className="flex items-center gap-1">
        <HoldButton className={stepButtonClass} onTrigger={() => onChange(value - stepDelta)}>−{stepDelta}</HoldButton>
      <input
        ref={inputRef}
        type="text"
        className="h-5 w-16 border-0 bg-transparent px-1 text-center font-mono text-xs text-teal-300 outline-none focus:bg-(--aee-accent-35)"
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
        <HoldButton className={stepButtonClass} onTrigger={() => onChange(value + stepDelta)}>+{stepDelta}</HoldButton>
        {onReset ? <button className={resetButtonClass} onClick={onReset}>↺</button> : null}
      </div>
    </div>
    <div className="relative flex items-center">
      <input ref={rangeRef} type="range" className={tallRangeClass} min={min} max={max} step={step}
             defaultValue={rangeValue} onChange={event => onChange(Number(event.target.value))}
             onPointerDown={event => event.stopPropagation()}/>
      <span className="pointer-events-none absolute left-1/2 top-1/2 h-[19px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded bg-(--aee-accent)"/>
    </div>
  </div>;
}, (prev, next) => prev.value === next.value && prev.min === next.min && prev.max === next.max && prev.display === next.display && prev.inputValue === next.inputValue && prev.stepDelta === next.stepDelta);
