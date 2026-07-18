import {type CSSProperties, forwardRef, type HTMLAttributes} from 'react';
import cn from '@/util/cn';

export const Panel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { soft?: boolean }>(
  function Panel({className, style, soft = false, ...props}, ref) {
    return <div
      ref={ref}
      className={cn('flex flex-col overflow-hidden text-(--aee-text) backdrop-blur-[2px]', className)}
      style={{
        background: `linear-gradient(to bottom, rgba(255,255,255,0.045), transparent 120px), var(${soft ? '--aee-panel-bg-soft' : '--aee-panel-bg'})`,
        border: 'var(--aee-panel-border)',
        borderRadius: 'var(--aee-panel-radius)',
        boxShadow: 'var(--aee-panel-shadow)',
        ...style,
      } as CSSProperties}
      {...props}
    />;
  });
