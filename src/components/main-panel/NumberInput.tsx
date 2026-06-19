import {memo, useEffect, useRef} from 'react';

export const NumberInput = memo(function NumberInput({min, max, step, value, onChange, className}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.value = String(value);
    }
  }, [value]);

  return <input
    ref={ref}
    type="number"
    className={className}
    min={min}
    max={max}
    step={step}
    defaultValue={value}
    onInput={event => onChange(Number((event.target as HTMLInputElement).value))}
  />;
}, (prev, next) => prev.value === next.value && prev.min === next.min && prev.max === next.max && prev.step === next.step && prev.className === next.className);
