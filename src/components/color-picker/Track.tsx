import {type MouseEvent as ReactMouseEvent} from 'react';

export function Track({label, value, max, bg, color, overlay, inputValue, onPick, onInput}: {label: string; value: number; max: number; bg: string; color: string; overlay?: string; inputValue: string | number; onPick: (pct: number) => void; onInput: (value: number) => void}) {
  const pickTrack = (event: ReactMouseEvent<HTMLElement>) => {
    const el = event.currentTarget as HTMLElement;
    const pick = (clientX: number) => {
      const r = el.getBoundingClientRect();
      onPick(Math.max(0, Math.min(1, (clientX - r.left) / r.width)));
    };
    pick(event.clientX);
    const onMove = (ev: MouseEvent) => pick(ev.clientX);
    const onUp = () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
    };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
  };

  return <div className="flex items-center gap-2">
    <span className="w-4 shrink-0 text-right text-[11px] text-zinc-400">{label}</span>
    <div className="relative h-3.5 flex-1 cursor-pointer rounded-full border border-zinc-700" style={{background: bg}} onMouseDown={pickTrack}>
      {overlay ? <div className="absolute inset-0 rounded-full" style={{background: overlay}}/> : null}
      <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{left: `${value / max * 100}%`, background: color}}/>
    </div>
    <input className="w-10 shrink-0 border-b border-zinc-700 bg-transparent px-0.5 text-right font-mono text-[11px] text-zinc-100 outline-none focus:border-violet-400" value={inputValue} onChange={event => {
      const n = parseInt(event.target.value.replace('%', ''), 10);
      if (!Number.isNaN(n)) onInput(n);
    }}/>
  </div>;
}
