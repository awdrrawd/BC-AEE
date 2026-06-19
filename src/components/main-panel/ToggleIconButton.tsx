import type {MouseEvent as ReactMouseEvent, ReactNode} from 'react';
import {activeIconButtonClass, iconButtonClass} from '@/components/main-panel/styles';

export function ToggleIconButton({active, title, children, onClick}: {
  active: boolean;
  title: string;
  children: ReactNode;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void
}) {
  return <button className={`${iconButtonClass} ${active ? activeIconButtonClass : ''}`} title={title}
                 style={active ? {boxShadow: 'inset 2px 0 0 #8b5cf6'} : undefined}
                 onClick={onClick}>{children}</button>;
}
