import {type MouseEvent as ReactMouseEvent, useEffect, useRef} from 'react';
import type {AeeState} from '@/core/types';
import {t} from '@/i18n/i18n';
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
import {Switch} from '@/components/ui/Switch';
import {OffsetSlider} from '@/components/view-controls/OffsetSlider';
import {Button, IconButton} from '@/components/ui/Button';
import {ChevronDown, ChevronUp, X} from 'lucide-react';
import {Panel} from '@/components/ui/Panel';
import {clamp} from '@/util/math';
import {settings, useSetting} from '@/core/settings';

export function OffsetPanel({state}: { state: AeeState }) {
  const charOffsetX = useSetting(settings.charOffsetX);
  const charOffsetY = useSetting(settings.charOffsetY);
  const charScale = useSetting(settings.charScale);
  const drag = useRef<{ pointerId: number; sx: number; sy: number; left: number; top: number } | null>(null);
  const minimapThumbRef = useRef<HTMLSpanElement>(null);
  const pendingOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const offsetFrameRef = useRef<number | null>(null);

  const setMinimapThumbPosition = (x: number, y: number) => {
    const thumb = minimapThumbRef.current;
    if (!thumb) return;
    const left = clamp(((x + 700) / 1500) * 100, 2, 98);
    const top = clamp(((y + 2000) / 4000) * 100, 2, 98);
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
      x: clamp(Math.round(x), -700, 800),
      y: clamp(Math.round(y), -2000, 2000),
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
    setMinimapThumbPosition(charOffsetX, charOffsetY);
  }, [charOffsetX, charOffsetY]);

  if (!state.offset.open || !state.canvasRect) return null;
  const left = state.offset.left ?? state.canvasRect.left + state.canvasRect.width * 0.4;
  const top = state.offset.top ?? state.canvasRect.top + state.canvasRect.height * 0.3;
  const mmX = clamp(((charOffsetX + 700) / 1500) * 100, 2, 98);
  const mmY = clamp(((charOffsetY + 2000) / 4000) * 100, 2, 98);

  const minimapPick = (event: ReactMouseEvent<HTMLElement>) => {
    const el = event.currentTarget;
    const pick = (clientX: number, clientY: number) => {
      const r = el.getBoundingClientRect();
      const rx = clamp((clientX - r.left) / r.width, 0, 1);
      const ry = clamp((clientY - r.top) / r.height, 0, 1);
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

  return <Panel
    className="fixed z-999993 w-64"
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
        className="text-[11px] font-bold uppercase text-(--aee-accent)">⟳ {t('offset-panel-title')}</span>
      <div className="flex gap-1">
        <IconButton icon={state.offset.collapsed ? <ChevronUp className="h-3 w-3"/> : <ChevronDown className="h-3 w-3"/>}
                    aria-label={t('offset-panel-title')} onClick={toggleOffsetCollapsed}/>
        <Button iconOnly className="h-7 w-7" aria-label={t('offset-panel-title')}
                onClick={() => resetOffset('all')}>↺</Button>
        <IconButton tone="danger" icon={<X className="h-3.5 w-3.5"/>}
                    aria-label={t('offset-panel-title')} onClick={() => toggleOffsetPanel(false)}/>
      </div>
    </div>
    <div className="bg-zinc-950 px-2.5 pt-2">
      <div className="relative h-28 cursor-crosshair overflow-visible rounded border border-zinc-700 bg-zinc-900"
           onMouseDown={minimapPick}>
        <span
          ref={minimapThumbRef}
          className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-(--aee-accent-65)"
          style={{left: `${mmX}%`, top: `${mmY}%`}}/>
      </div>
      <div
        className="mt-1 text-center text-[9px] tracking-wide text-zinc-600">{t('offset-panel-minimap-help')}</div>
    </div>
    <div className={`${state.offset.collapsed ? 'hidden' : 'flex'} flex-col gap-2 px-3 py-2.5`}>
      <OffsetSlider label={t('offset-panel-x-slider-label')} min={-700} max={800} step={10} value={charOffsetX}
                    display={(charOffsetX > 0 ? '+' : '') + charOffsetX} onChange={setOffsetX}
                    onReset={() => resetOffset('x')}/>
      <OffsetSlider label={t('offset-panel-y-slider-label')} min={-2000} max={2000} step={10} value={charOffsetY}
                    display={(charOffsetY > 0 ? '+' : '') + charOffsetY} onChange={setOffsetY}
                    onReset={() => resetOffset('y')}/>
      <OffsetSlider label={t('offset-panel-scale-slider-label')} min={20} max={500} step={5}
                    value={Math.round(charScale * 100)} display={`${Math.round(charScale * 100)}%`}
                    onChange={(value: number) => setCharScale(value / 100)} onReset={() => resetOffset('scale')}/>
      <div className="h-px bg-zinc-800"/>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-zinc-400">{t('offset-panel-wheel-control-label')}</span>
        <Switch checked={state.offset.wheelControl} onChange={toggleWheelControl} size="md"
                ariaLabel={t('offset-panel-wheel-control-aria-label')}/>
      </div>
      <div
        className={`whitespace-pre-line text-[11px] leading-4 text-zinc-400 ${state.offset.wheelControl ? 'block' : 'hidden'}`}>{t('offset-panel-wheel-control-help')}</div>
    </div>
  </Panel>;
}
