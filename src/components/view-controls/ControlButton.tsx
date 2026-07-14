import type {ReactNode} from 'react';
import {CTRL_ICON_FRAME} from '@/controllers/viewController';

export function ControlButton({active, label, icon, onClick}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void
}) {

  return <button
    className={`relative h-13 w-13 shrink-0 overflow-hidden rounded-lg border-0 bg-transparent p-0 pointer-events-auto ${active ? '[&_.aee-frame]:brightness-125 [&_.aee-frame]:hue-rotate-160' : ''}`}
    title={label} onClick={onClick}>
    <span className="aee-frame pointer-events-none absolute inset-0 bg-cover bg-center"
          style={{backgroundImage: `url(${CTRL_ICON_FRAME})`}}/>
    <span
      className="pointer-events-none absolute inset-2 flex items-center justify-center text-white [&_svg]:h-7 [&_svg]:w-7">{icon}</span>
    <span className='pointer-events-none absolute inset-x-0 bottom-0.5 text-center text-[8px] tracking-wide text-white [text-shadow:0_1px_2px_rgba(0,0,0,.9)]'>{label}</span>
  </button>;
}
