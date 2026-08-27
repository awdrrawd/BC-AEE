import {memo, useEffect, useRef} from 'react';
import {resetEditProperty, setEditProperty, stepEditProperty} from '@/controllers/uiController';
import {useHoldRepeat} from '@/components/ui/useHoldRepeat';
import {resetButtonClass, stepButtonClass} from '@/components/main-panel/styles';
import {tallRangeClass} from '@/components/main-panel/styles';

export const MirrorAxisInput = memo(function MirrorAxisInput({label, ctrl, value}: {
  label: string;
  ctrl: 'fcx' | 'fcy';
  value: number
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dec = useHoldRepeat(() => stepEditProperty(ctrl, -0.1));
  const inc = useHoldRepeat(() => stepEditProperty(ctrl, 0.1));
  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = value.toFixed(2);
    }
  }, [value]);

  return <div>
    <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
    <span className="w-7 shrink-0 font-semibold">{label}</span>
    <div className="flex items-center gap-1">
      <button className={stepButtonClass} {...dec}>−0.1</button>
    <input
      ref={inputRef}
      className="h-5 w-16 border-0 bg-transparent text-center font-mono text-xs text-teal-300 outline-none focus:bg-(--aee-accent-35)"
      defaultValue={value.toFixed(2)}
      onBlur={event => setEditProperty(ctrl, Number(event.target.value))}/>
    <button className={stepButtonClass} {...inc}>+0.1</button>
    <button className={resetButtonClass} onClick={() => resetEditProperty(ctrl)}>↺</button>
    </div>
    </div>
    <div className="relative flex items-center">
      <input type="range" min={-10} max={10} step={0.01} value={value} className={tallRangeClass}
             onChange={event => setEditProperty(ctrl, Number(event.target.value))}/>
      <span className="pointer-events-none absolute left-1/2 top-1/2 h-[19px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded bg-(--aee-accent)"/>
    </div>
  </div>;
}, (prev, next) => prev.ctrl === next.ctrl && prev.value === next.value);
