import type {CSSProperties, ReactNode} from 'react';
import cn from '@/util/cn';
import {Panel} from '@/components/ui/Panel';

export function Dialog({onDismiss, className, style, children}: {
  onDismiss: () => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return <div
    className="aee-fade-in absolute inset-0 z-20 flex items-center justify-center bg-black/90"
    role="presentation"
    onClick={onDismiss}
  >
    <Panel
      className={cn('aee-pop-in relative flex flex-col', className)}
      style={style}
      role="dialog"
      aria-modal="true"
      onClick={event => event.stopPropagation()}
    >
      {children}
    </Panel>
  </div>;
}
