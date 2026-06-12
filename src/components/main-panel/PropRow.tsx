import {resetEditProperty, setEditProperty, stepEditProperty} from '@/controllers/uiController';
import {resetButtonClass, stepButtonClass} from '@/components/main-panel/styles';

export function PropRow({label, value, ctrl, deltas}: {
  label: string;
  value: string | number;
  ctrl: string;
  deltas: number[]
}) {
  return <div className="mb-1">
    <div className="mb-1 flex items-center justify-between text-xs text-zinc-300">
      <span>{label}</span>
      <input
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
      {deltas.map(delta => <button key={delta} className={stepButtonClass}
                                   onClick={() => stepEditProperty(ctrl, delta)}>{delta > 0 ? '+' : ''}{delta}</button>)}
      <button className={resetButtonClass} onClick={() => resetEditProperty(ctrl)}>↺</button>
    </div>
  </div>;
}
