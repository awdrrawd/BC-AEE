import {memo, useEffect, useRef} from 'react';
import {resetEditProperty, setEditProperty, stepEditProperty} from '@/controllers/uiController';
import {resetButtonClass, stepButtonClass, tallRangeClass} from '@/components/main-panel/styles';
import {HoldButton} from '@/components/ui/HoldButton';
import {RangeCenterMark} from '@/components/ui/RangeCenterMark';

export const PropRow = memo(function PropRow({label, value, ctrl, deltas}: {
  label: string;
  value: string | number;
  ctrl: string;
  deltas: number[]
}) {
  const numericValue = Number(value);
  const step = Math.min(...deltas.filter(delta => delta > 0));
  const coordinateMax = Math.max(1000, Math.ceil(Math.abs(numericValue) / 100) * 100);
  const bounds: Record<string, [number, number, number]> = {
    x: [-coordinateMax, coordinateMax, 1], y: [-coordinateMax, coordinateMax, 1], rot: [-180, 180, 1],
    sx: [0.05, 3, 0.01], sy: [0.05, 3, 0.01], skx: [-60, 60, 0.1], sky: [-60, 60, 0.1],
  };
  const [min, max, rangeStep] = bounds[ctrl] ?? [-100, 100, step];
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = String(value);
    }
  }, [value]);

  return <div className="mb-1">
    <div className="mb-1 flex items-center justify-between gap-2 text-xs text-zinc-300">
      <span className="w-7 shrink-0">{label}</span>
      <div className="flex items-center gap-1">
        <HoldButton className={stepButtonClass} onTrigger={() => stepEditProperty(ctrl, -step)}>−{step}</HoldButton>
      <input
        ref={inputRef}
        type="text"
        className="h-5 w-16 border-0 bg-transparent text-center font-mono text-xs text-teal-300 outline-none focus:bg-(--aee-accent-35)"
        defaultValue={value}
        onBlur={event => setEditProperty(ctrl, Number.parseFloat(event.target.value))}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            setEditProperty(ctrl, Number.parseFloat((event.target as HTMLInputElement).value));
            (event.target as HTMLInputElement).blur();
          }
        }}
        onMouseDown={event => event.stopPropagation()}
        onClick={event => event.stopPropagation()}
      />
        <HoldButton className={stepButtonClass} onTrigger={() => stepEditProperty(ctrl, step)}>+{step}</HoldButton>
        <button className={resetButtonClass} onClick={() => resetEditProperty(ctrl)}>↺</button>
      </div>
    </div>
    <div className="relative flex items-center">
      <input type="range" className={tallRangeClass} min={min} max={max} step={rangeStep}
             value={Math.max(min, Math.min(max, numericValue))}
             onChange={event => setEditProperty(ctrl, Number(event.target.value))}/>
      <RangeCenterMark/>
    </div>
  </div>;
}, (prev, next) => prev.ctrl === next.ctrl && String(prev.value) === String(next.value));
