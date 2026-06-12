import {setEditProperty, stepEditProperty} from '../../controllers/uiController';

export function MirrorAxisInput({label, ctrl, value}: { label: string; ctrl: 'fcx' | 'fcy'; value: number }) {
  return <div className="flex min-w-0 flex-1 items-center gap-1">
    <span className="shrink-0">{label}</span>
    <button className="h-5 w-5 shrink-0 rounded border border-zinc-700 bg-zinc-800 hover:bg-violet-600"
            onClick={() => stepEditProperty(ctrl, -0.05)}>-
    </button>
    <input
      className="min-w-0 flex-1 border-b border-zinc-700 bg-transparent text-center font-mono text-[11px] text-teal-300"
      defaultValue={value.toFixed(2)} onBlur={event => setEditProperty(ctrl, Number(event.target.value))}/>
    <button className="h-5 w-5 shrink-0 rounded border border-zinc-700 bg-zinc-800 hover:bg-violet-600"
            onClick={() => stepEditProperty(ctrl, 0.05)}>+
    </button>
  </div>;
}
