import type {ReactNode} from 'react';
import {CTRL_ICON_FRAME} from '../../controllers/viewController';
import {ctrlButtonBaseClass, ctrlLabelClass} from './styles';

export function ControlButton({active, label, icon, onClick}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void
}) {
  return <button
    className={`${ctrlButtonBaseClass} ${active ? '[&_.aee-frame]:brightness-125 [&_.aee-frame]:hue-rotate-160' : ''}`}
    title={label} onClick={onClick}>
    <span className="aee-frame pointer-events-none absolute inset-0 bg-cover bg-center"
          style={{backgroundImage: `url(${CTRL_ICON_FRAME})`}}/>
    <span
      className="pointer-events-none absolute inset-2 flex items-center justify-center [&_svg]:h-7 [&_svg]:w-7">{icon}</span>
    <span className={ctrlLabelClass}>{label}</span>
  </button>;
}
