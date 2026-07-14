import {memo, type PointerEvent as ReactPointerEvent, useEffect, useRef} from 'react';
import {clamp} from '@/util/math';

export const Track = memo(function Track({label, value, max, bg, overlay, inputValue, onPick, onInput}: {
  label: string;
  value: number;
  max: number;
  bg: string;
  overlay?: string;
  inputValue: string | number;
  onPick: (pct: number, preview?: boolean) => void;
  onInput: (value: number) => void
}) {
  const dragRef = useRef<number | null>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const trackInputRef = useRef<HTMLInputElement>(null);
  const pendingPctRef = useRef<number | null>(null);
  const latestPctRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const pct = clamp(value / max, 0, 1);

  useEffect(() => {
    if (trackInputRef.current && document.activeElement !== trackInputRef.current) {
      trackInputRef.current.value = String(inputValue);
    }
  }, [inputValue]);

  useEffect(() => {
    if (dragRef.current !== null) return;
    if (thumbRef.current) thumbRef.current.style.left = `${pct * 100}%`;
  }, [pct]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  const flushPick = () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    const pct = pendingPctRef.current ?? latestPctRef.current;
    pendingPctRef.current = null;
    latestPctRef.current = null;
    if (pct !== null) onPick(pct, false);
  };

  const queuePick = (pct: number) => {
    pendingPctRef.current = pct;
    latestPctRef.current = pct;
    if (thumbRef.current) thumbRef.current.style.left = `${pct * 100}%`;
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const nextPct = pendingPctRef.current;
      pendingPctRef.current = null;
      if (nextPct !== null) onPick(nextPct, true);
    });
  };

  const pickTrack = (el: HTMLElement, clientX: number) => {
    const r = el.getBoundingClientRect();
    queuePick(clamp((clientX - r.left) / r.width, 0, 1));
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
    flushPick();
  };

  const cancelPick = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragRef.current === event.pointerId) {
      dragRef.current = null;
      flushPick();
    }
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
        ref={thumbRef}
        className="absolute top-1/2 h-4.5 w-4.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent"
        style={{
          left: `${pct * 100}%`,
          border: '3px solid #fff',
          outline: '1px solid rgba(0,0,0,.7)',
          boxShadow: '0 1px 4px rgba(0,0,0,.55)',
        }}
      />
    </div>
    <input
      ref={trackInputRef}
      className="w-10 shrink-0 border-b border-zinc-700 bg-transparent px-0.5 text-right font-mono text-[11px] text-zinc-100 outline-none focus:border-(--aee-accent)"
      defaultValue={inputValue}
      onBlur={event => {
        const n = parseInt(event.target.value.replace('%', ''), 10);
        if (!Number.isNaN(n)) onInput(n);
      }}
      onChange={event => {
        const n = parseInt(event.target.value.replace('%', ''), 10);
        if (!Number.isNaN(n)) onInput(n);
      }}/>
  </div>;
}, (prev, next) => prev.value === next.value && prev.max === next.max && prev.bg === next.bg && prev.overlay === next.overlay && prev.inputValue === next.inputValue);
