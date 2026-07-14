import {type ReactNode, useRef} from 'react';
import type {CanvasRect} from '@/core/types';
import {TOOL_PANEL_WIDTH} from '@/core/overlay';
import {Panel} from '@/components/ui/Panel';
import {IconButton} from '@/components/ui/Button';
import {X} from 'lucide-react';

export function FloatingPanel({
                                canvasRect,
                                left,
                                top,
                                width = TOOL_PANEL_WIDTH,
                                title,
                                subtitle,
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
  onClose: () => void;
  onMove: (left: number, top: number) => void;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const drag = useRef<{ pointerId: number; sx: number; sy: number; left: number; top: number } | null>(null);

  return <div className="fixed z-999996 pointer-events-none"
              style={{left: canvasRect.left, top: canvasRect.top, width: canvasRect.width, height: canvasRect.height}}>
    <Panel
      className={`pointer-events-auto absolute ${className}`}
      style={{left, top, width}}
    >
      <div
        className="flex h-8 cursor-grab select-none items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-2 active:cursor-grabbing"
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
        <IconButton
          className="h-5 w-5 border-0"
          tone="danger"
          icon={<X className="h-3.5 w-3.5"/>}
          aria-label={title}
          onPointerDown={event => event.stopPropagation()}
          onClick={onClose}
        />
      </div>
      <div className={bodyClassName}>
        {children}
      </div>
    </Panel>
  </div>;
}
