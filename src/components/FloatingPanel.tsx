import {type ReactNode, useRef} from 'react';
import type {CanvasRect} from '@/core/types';
import {TOOL_PANEL_WIDTH} from '@/core/overlay';
import {Panel} from '@/components/ui/Panel';

export function FloatingPanel({
                                canvasRect,
                                left,
                                top,
                                width = TOOL_PANEL_WIDTH,
                                title,
                                subtitle,
                                headerActions,
                                onClose,
                                onMove,
                                className = '',
                                bodyClassName = 'flex flex-col gap-2 px-3 py-2.5',
                                children,
                              }: {
  canvasRect: CanvasRect;
  left: number;
  top: number;
  width?: number;
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
  onClose: () => void;
  onMove: (left: number, top: number) => void;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const drag = useRef<{ pointerId: number; sx: number; sy: number; left: number; top: number } | null>(null);
  const scale = canvasRect.width / 2000;

  return <div className="fixed z-1000002 pointer-events-none"
              style={{left: canvasRect.left, top: canvasRect.top, width: canvasRect.width, height: canvasRect.height}}>
    <Panel
      className={`aee-control pointer-events-auto absolute ${className}`}
      style={{left, top, width, transform: `scale(${scale})`, transformOrigin: 'top left'}}
    >
      <div
        className="flex min-h-[48px] cursor-grab select-none items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-3 active:cursor-grabbing"
        style={{minHeight: Math.max(48, 35 / scale)}}
        onPointerDown={event => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {pointerId: event.pointerId, sx: event.clientX, sy: event.clientY, left, top};
        }}
        onPointerMove={event => {
          if (!drag.current || drag.current.pointerId !== event.pointerId) return;
          onMove(drag.current.left + event.clientX - drag.current.sx, drag.current.top + event.clientY - drag.current.sy);
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
          className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-bold uppercase text-[var(--aee-accent)]">{title}</span>
        {subtitle ? <span
          className="max-w-24 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-zinc-500">{subtitle}</span> : null}
        {headerActions}
        <button type="button"
          className="h-[25px] w-[35px] rounded border border-red-800 bg-red-950/60 text-red-200 transition hover:border-red-300 hover:bg-red-900"
          style={{width: 35 / scale, height: 25 / scale, minHeight: 25 / scale, padding: 0, fontSize: 18 / scale, lineHeight: 1}}
          aria-label={title}
          onPointerDown={event => event.stopPropagation()}
          onClick={onClose}
        >×</button>
      </div>
      <div className={bodyClassName}>
        {children}
      </div>
    </Panel>
  </div>;
}
