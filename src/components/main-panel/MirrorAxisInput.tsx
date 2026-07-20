import {memo, useEffect, useRef} from 'react';
import {setEditProperty, stepEditProperty} from '@/controllers/uiController';
import {useHoldRepeat} from '@/components/ui/useHoldRepeat';

export const MirrorAxisInput = memo(function MirrorAxisInput({label, ctrl, value}: {
  label: string;
  ctrl: 'fcx' | 'fcy';
  value: number
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dec = useHoldRepeat(() => stepEditProperty(ctrl, -0.05));
  const inc = useHoldRepeat(() => stepEditProperty(ctrl, 0.05));
  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = value.toFixed(2);
    }
  }, [value]);

  return <div className="flex min-w-0 flex-1 items-center gap-1">
    <span className="shrink-0">{label}</span>
    <button className="h-5 w-5 shrink-0 rounded border border-zinc-700 bg-zinc-800 hover:bg-[var(--aee-accent-65)]"
            {...dec}>-
    </button>
    <input
      ref={inputRef}
      className="min-w-0 flex-1 border-b border-zinc-700 bg-transparent text-center font-mono text-[11px] text-teal-300"
      defaultValue={value.toFixed(2)}
      onBlur={event => setEditProperty(ctrl, Number(event.target.value))}/>
    <button className="h-5 w-5 shrink-0 rounded border border-zinc-700 bg-zinc-800 hover:bg-[var(--aee-accent-65)]"
            {...inc}>+
    </button>
  </div>;
}, (prev, next) => prev.ctrl === next.ctrl && prev.value === next.value);
