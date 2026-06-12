import type {ReactNode} from 'react';
import {panelButtonActiveClass, panelButtonBaseClass, panelButtonDangerClass, panelButtonNormalClass,} from '@/components/overlays/styles';

export function PanelButton({children, onClick, tone = 'normal', size = 'md', className = ''}: {
  children: ReactNode;
  onClick: () => void;
  tone?: 'normal' | 'active' | 'danger';
  size?: 'sm' | 'md';
  className?: string
}) {
  const toneClass = tone === 'active' ? panelButtonActiveClass : tone === 'danger' ? panelButtonDangerClass : panelButtonNormalClass;
  const sizeClass = size === 'sm' ? 'h-6' : 'h-7';
  return <button className={`${panelButtonBaseClass} ${sizeClass} ${toneClass} ${className}`}
                 onClick={onClick}>{children}</button>;
}
