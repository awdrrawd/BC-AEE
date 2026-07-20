import {memo, useEffect, useRef} from 'react';
import {resetEditProperty, setEditProperty, stepEditProperty} from '@/controllers/uiController';
import {resetButtonClass, stepButtonClass} from '@/components/main-panel/styles';
import {HoldButton} from '@/components/ui/HoldButton';

export const PropRow = memo(function PropRow({label, value, ctrl, deltas}: {
  label: string;
  value: string | number;
  ctrl: string;
  deltas: number[]
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = String(value);
    }
  }, [value]);

  return <div className="mb-1">
    <div className="mb-1 flex items-center justify-between text-xs text-zinc-300">
      <span>{label}</span>
      <input
        ref={inputRef}
        type="text"
        className="w-14 border-b border-transparent bg-transparent text-right font-mono text-xs text-teal-300 outline-none focus:border-teal-300 focus:bg-teal-300/10"
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
    </div>
    <div className="flex gap-0.5">
      {deltas.map(delta => <HoldButton key={delta} className={stepButtonClass}
                                       onTrigger={() => stepEditProperty(ctrl, delta)}>{delta > 0 ? '+' : ''}{delta}</HoldButton>)}
      <button className={resetButtonClass} onClick={() => resetEditProperty(ctrl)}>↺</button>
    </div>
  </div>;
}, (prev, next) => prev.ctrl === next.ctrl && String(prev.value) === String(next.value));
