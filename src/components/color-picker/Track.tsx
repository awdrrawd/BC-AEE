import {type PointerEvent as ReactPointerEvent, useRef} from 'react';

export function Track({label, value, max, bg, overlay, inputValue, onPick, onInput}: {
  label: string;
  value: number;
  max: number;
  bg: string;
  overlay?: string;
  inputValue: string | number;
  onPick: (pct: number) => void;
  onInput: (value: number) => void
}) {
  const dragRef = useRef<number | null>(null);
  const pct = Math.max(0, Math.min(1, value / max));

  const pickTrack = (el: HTMLElement, clientX: number) => {
    const r = el.getBoundingClientRect();
    onPick(Math.max(0, Math.min(1, (clientX - r.left) / r.width)));
  };

  const startPick = (event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = event.pointerId;
    pickTrack(event.currentTarget, event.clientX);
  };

  const movePick = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    pickTrack(event.currentTarget, event.clientX);
  };

  const stopPick = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  };

  const cancelPick = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragRef.current === event.pointerId) dragRef.current = null;
  };

  return <div className="flex items-center gap-2">
    <span className="w-4 shrink-0 text-right text-[11px] text-zinc-400">{label}</span>
    <div
      className="relative h-3.5 flex-1 cursor-pointer select-none touch-none rounded-full border border-zinc-700 [-webkit-user-drag:none]"
      style={{background: bg}}
      draggable={false}
      onDragStart={event => event.preventDefault()}
      onPointerDown={startPick}
      onPointerMove={movePick}
      onPointerUp={stopPick}
      onPointerCancel={cancelPick}
      onLostPointerCapture={cancelPick}
    >
      {overlay ? <div className="absolute inset-0 rounded-full" style={{background: overlay}}/> : null}
      <div
        className="absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent"
        style={{
          left: `${pct * 100}%`,
          border: '3px solid #fff',
          outline: '1px solid rgba(0,0,0,.7)',
          boxShadow: '0 1px 4px rgba(0,0,0,.55)',
        }}
      />
    </div>
    <input
      className="w-10 shrink-0 border-b border-zinc-700 bg-transparent px-0.5 text-right font-mono text-[11px] text-zinc-100 outline-none focus:border-violet-400"
      value={inputValue} onChange={event => {
      const n = parseInt(event.target.value.replace('%', ''), 10);
      if (!Number.isNaN(n)) onInput(n);
    }}/>
  </div>;
}
