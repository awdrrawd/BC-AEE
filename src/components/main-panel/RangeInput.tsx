import {memo, useEffect, useRef} from 'react';
import {rangeClass} from '@/components/main-panel/styles';

export const RangeInput = memo(function RangeInput({min, max, step, value, onChange}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.value = String(value);
    }
  }, [value]);

  return <input
    ref={ref}
    type="range"
    className={rangeClass}
    min={min}
    max={max}
    step={step}
    defaultValue={value}
    onInput={event => onChange(Number((event.target as HTMLInputElement).value))}
  />;
}, (prev, next) => prev.value === next.value && prev.min === next.min && prev.max === next.max && prev.step === next.step);
