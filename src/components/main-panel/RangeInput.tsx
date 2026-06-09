import {rangeClass} from './styles';

export function RangeInput({min, max, step, value, onChange}: {min: number; max: number; step: number; value: number; onChange: (value: number) => void}) {
  return <input type="range" className={rangeClass} min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))}/>;
}
