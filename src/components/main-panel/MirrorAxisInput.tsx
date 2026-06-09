import {setEditProperty, stepEditProperty} from '../../controllers/uiController';

export function MirrorAxisInput({label, ctrl, value}: {label: string; ctrl: 'fcx' | 'fcy'; value: number}) {
  return <>
    <span>{label}</span>
    <button className="h-5 w-5 rounded border border-zinc-700 bg-zinc-800 hover:bg-violet-600" onClick={() => stepEditProperty(ctrl, -0.05)}>-</button>
    <input className="w-9 border-b border-zinc-700 bg-transparent text-center font-mono text-[11px] text-teal-300" defaultValue={value.toFixed(2)} onBlur={event => setEditProperty(ctrl, Number(event.target.value))}/>
    <button className="h-5 w-5 rounded border border-zinc-700 bg-zinc-800 hover:bg-violet-600" onClick={() => stepEditProperty(ctrl, 0.05)}>+</button>
  </>;
}
