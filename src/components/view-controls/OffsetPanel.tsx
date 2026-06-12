import {type MouseEvent as ReactMouseEvent, useEffect, useRef} from 'react';
import type {AeeState} from '@/core/types';
import {isZh} from '@/core/lang';
import {runtime} from '@/core/runtime';
import {
  moveOffsetPanel,
  resetOffset,
  setCharScale,
  setOffsetX,
  setOffsetXY,
  setOffsetY,
  toggleOffsetCollapsed,
  toggleOffsetPanel,
  toggleWheelControl,
} from '@/controllers/viewController';
import {ChevronIcon} from '@/components/icons/ChevronIcon';
import {Switch} from '@/components/Switch';
import {OffsetSlider} from '@/components/view-controls/OffsetSlider';
import {PanelIconButton} from '@/components/view-controls/PanelIconButton';

export function OffsetPanel({state}: { state: AeeState }) {
  const drag = useRef<{ pointerId: number; sx: number; sy: number; left: number; top: number } | null>(null);
  const minimapThumbRef = useRef<HTMLSpanElement>(null);
  const pendingOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const offsetFrameRef = useRef<number | null>(null);

  const setMinimapThumbPosition = (x: number, y: number) => {
    const thumb = minimapThumbRef.current;
    if (!thumb) return;
    const left = Math.max(2, Math.min(98, ((x + 700) / 1500) * 100));
    const top = Math.max(2, Math.min(98, ((y + 2000) / 4000) * 100));
    thumb.style.left = `${left}%`;
    thumb.style.top = `${top}%`;
  };

  const flushPendingOffset = (persist: boolean) => {
    if (offsetFrameRef.current !== null) {
      cancelAnimationFrame(offsetFrameRef.current);
      offsetFrameRef.current = null;
    }
    const pending = pendingOffsetRef.current;
    pendingOffsetRef.current = null;
    const next = pending ?? (persist ? runtime.offsetPreview : null);
    if (next) setOffsetXY(next.x, next.y, persist);
    if (persist) runtime.offsetPreview = null;
  };

  const queueOffset = (x: number, y: number) => {
    const next = {
      x: Math.max(-700, Math.min(800, Math.round(x))),
      y: Math.max(-2000, Math.min(2000, Math.round(y))),
    };
    runtime.offsetPreview = next;
    pendingOffsetRef.current = next;
    setMinimapThumbPosition(next.x, next.y);
    if (offsetFrameRef.current !== null) return;
    offsetFrameRef.current = requestAnimationFrame(() => {
      offsetFrameRef.current = null;
      const pending = pendingOffsetRef.current;
      pendingOffsetRef.current = null;
      if (pending) setOffsetXY(pending.x, pending.y, false);
    });
  };

  useEffect(() => () => {
    flushPendingOffset(true);
  }, []);

  useEffect(() => {
    if (pendingOffsetRef.current) return;
    setMinimapThumbPosition(state.offset.x, state.offset.y);
  }, [state.offset.x, state.offset.y]);

  if (!state.offset.open || !state.canvasRect) return null;
  const left = state.offset.left ?? state.canvasRect.left + state.canvasRect.width * 0.4;
  const top = state.offset.top ?? state.canvasRect.top + state.canvasRect.height * 0.3;
  const mmX = Math.max(2, Math.min(98, ((state.offset.x + 700) / 1500) * 100));
  const mmY = Math.max(2, Math.min(98, ((state.offset.y + 2000) / 4000) * 100));

  const minimapPick = (event: ReactMouseEvent<HTMLElement>) => {
    const el = event.currentTarget;
    const pick = (clientX: number, clientY: number) => {
      const r = el.getBoundingClientRect();
      const rx = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      const ry = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
      queueOffset(-700 + rx * 1500, -2000 + ry * 4000);
    };
    pick(event.clientX, event.clientY);
    const onMove = (ev: MouseEvent) => pick(ev.clientX, ev.clientY);
    const onUp = () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
      flushPendingOffset(true);
    };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
  };

  return <div
    className="fixed z-[999993] flex w-64 flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-100 shadow-2xl"
    style={{left, top}}>
    <div
      className="flex cursor-grab items-center justify-between border-b border-zinc-700 bg-zinc-900 px-2.5 py-1.5 active:cursor-grabbing"
      onPointerDown={event => {
        if ((event.target as HTMLElement).closest('button')) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {pointerId: event.pointerId, sx: event.clientX, sy: event.clientY, left, top};
      }}
      onPointerMove={event => {
        if (!drag.current || drag.current.pointerId !== event.pointerId) return;
        moveOffsetPanel(drag.current.left + event.clientX - drag.current.sx, drag.current.top + event.clientY - drag.current.sy);
      }}
      onPointerUp={event => {
        if (!drag.current || drag.current.pointerId !== event.pointerId) return;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        drag.current = null;
      }}
      onPointerCancel={event => {
        if (drag.current?.pointerId === event.pointerId) drag.current = null;
      }}
      onLostPointerCapture={event => {
        if (drag.current?.pointerId === event.pointerId) drag.current = null;
      }}
    >
      <span
        className="text-[11px] font-bold uppercase tracking-wider text-violet-400">⟳ {isZh() ? '位移控制' : 'Offset'}</span>
      <div className="flex gap-1">
        <PanelIconButton onClick={toggleOffsetCollapsed}>
          <ChevronIcon direction={state.offset.collapsed ? 'up' : 'down'} size={12}/>
        </PanelIconButton>
        <PanelIconButton onClick={() => resetOffset('all')}>↺</PanelIconButton>
        <PanelIconButton onClick={() => toggleOffsetPanel(false)}>x</PanelIconButton>
      </div>
    </div>
    <div className="bg-zinc-950 px-2.5 pt-2">
      <div className="relative h-28 cursor-crosshair overflow-visible rounded border border-zinc-700 bg-zinc-900"
           onMouseDown={minimapPick}>
        <span
          ref={minimapThumbRef}
          className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-violet-500"
          style={{left: `${mmX}%`, top: `${mmY}%`}}/>
      </div>
      <div
        className="mt-1 text-center text-[9px] tracking-wide text-zinc-600">{isZh() ? '點擊/拖移移動人物' : 'Click/drag to move character'}</div>
    </div>
    <div className={`${state.offset.collapsed ? 'hidden' : 'flex'} flex-col gap-2 px-3 py-2.5`}>
      <OffsetSlider label={isZh() ? '左右' : 'X'} min={-700} max={800} step={10} value={state.offset.x}
                    display={(state.offset.x > 0 ? '+' : '') + state.offset.x} onChange={setOffsetX}
                    onReset={() => resetOffset('x')}/>
      <OffsetSlider label={isZh() ? '上下' : 'Y'} min={-2000} max={2000} step={10} value={state.offset.y}
                    display={(state.offset.y > 0 ? '+' : '') + state.offset.y} onChange={setOffsetY}
                    onReset={() => resetOffset('y')}/>
      <OffsetSlider label={isZh() ? '縮放' : 'Scale'} min={20} max={500} step={5}
                    value={Math.round(state.offset.scale * 100)} display={`${Math.round(state.offset.scale * 100)}%`}
                    onChange={(value: number) => setCharScale(value / 100)} onReset={() => resetOffset('scale')}/>
      <div className="h-px bg-zinc-800"/>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-zinc-400">{isZh() ? '滾輪/鍵盤控制' : 'Wheel/Key ctrl'}</span>
        <Switch checked={state.offset.wheelControl} onChange={toggleWheelControl} size="md"
                ariaLabel={isZh() ? '滾輪/鍵盤控制' : 'Wheel/Key ctrl'}/>
      </div>
      <div
        className={`whitespace-pre-line text-[9px] leading-4 text-zinc-600 ${state.offset.wheelControl ? 'block' : 'hidden'}`}>{isZh() ? '滾輪按住/空白鍵=移動\n滾動/Ctrl+±=縮放' : 'Hold wheel/Space=Move\nScroll/Ctrl+±=Scale'}</div>
    </div>
  </div>;
}
