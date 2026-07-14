import {useRef} from 'react';
import type {AeeState} from '@/core/types';
import {t} from '@/i18n/i18n';
import {movePoseWindow, POSES, togglePoseWindow} from '@/controllers/viewController';
import {PoseButton} from '@/components/view-controls/PoseButton';
import {IconButton} from '@/components/ui/Button';
import {X} from 'lucide-react';
import {Panel} from '@/components/ui/Panel';

export function PoseWindow({state}: { state: AeeState }) {
  const drag = useRef<{ pointerId: number; sx: number; sy: number; left: number; top: number } | null>(null);
  if (!state.pose.open || !state.canvasRect) return null;
  const left = state.pose.left ?? Math.round(state.canvasRect.left + state.canvasRect.width * 0.36);
  const top = state.pose.top ?? Math.round(state.canvasRect.top + state.canvasRect.height * 0.08);
  return <Panel
    className="fixed z-999990"
    style={{left, top, width: 4 * (58 + 6) - 6 + 20}}>
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
        movePoseWindow(drag.current.left + event.clientX - drag.current.sx, drag.current.top + event.clientY - drag.current.sy);
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
      <span className="text-[11px] font-bold uppercase text-(--aee-accent)">{t('pose-window-title')}</span>
      <IconButton icon={<X className="h-3.5 w-3.5"/>} aria-label={t('pose-window-title')}
                  onClick={() => togglePoseWindow(false)}/>
    </div>
    <div className="grid grid-cols-4 gap-1.5 p-2.5">
      {POSES.map((pose, index) => <PoseButton key={pose.name} pose={pose} index={index}
                                              active={state.pose.activeIndex === index}/>)}
    </div>
  </Panel>;
}
