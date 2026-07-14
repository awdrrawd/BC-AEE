import type {ButtonHTMLAttributes, ReactNode} from 'react';
import cn from '@/util/cn';

type ButtonDensity = 'compact' | 'stage';
type ButtonTone = 'default' | 'primary' | 'danger' | 'ghost';

const densityClasses: Record<ButtonDensity, string> = {
  compact: 'min-h-7 gap-1.5 px-2 text-xs',
  stage: 'gap-2 px-3 text-[20px]',
};

const toneClasses: Record<ButtonTone, string> = {
  default: 'border-[var(--aee-accent-22)] bg-[var(--aee-control-bg)] text-[var(--aee-text)] enabled:hover:bg-[var(--aee-control-hover)]',
  primary: 'border-[var(--aee-accent)] bg-[var(--aee-accent-22)] text-[var(--aee-text-strong)] shadow-[0_0_8px_var(--aee-accent-35)] enabled:hover:bg-[var(--aee-accent-35)]',
  danger: 'border-red-500/80 bg-red-950/60 text-red-200 enabled:hover:bg-red-900/70',
  ghost: 'border-transparent bg-transparent text-[var(--aee-text-muted)] enabled:hover:bg-[var(--aee-accent-16)] enabled:hover:text-[var(--aee-text-strong)]',
};

export function Button({
                         density = 'compact',
                         tone = 'default',
                         selected = false,
                         icon,
                         iconOnly = false,
                         className,
                         children,
                         type = 'button',
                         ...props
                       }: ButtonHTMLAttributes<HTMLButtonElement> & {
  density?: ButtonDensity;
  tone?: ButtonTone;
  selected?: boolean;
  icon?: ReactNode;
  iconOnly?: boolean;
}) {
  const effectiveTone = selected && tone === 'default' ? 'primary' : tone;
  return <button
    type={type}
    className={cn(
      'group relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-(--aee-panel-radius) border transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--aee-accent-55)',
      'disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-black/30 disabled:text-zinc-600 disabled:shadow-none',
      iconOnly ? 'aspect-square p-0' : densityClasses[density],
      toneClasses[effectiveTone],
      className,
    )}
    {...props}
  >
    {icon ? <span className="flex h-[1.1em] w-[1.1em] shrink-0 items-center justify-center"
                  aria-hidden="true">{icon}</span> : null}
    {typeof children === 'string' || typeof children === 'number'
      ? <span className="min-w-0 truncate">{children}</span>
      : children}
  </button>;
}

export function IconButton({className, ...props}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: ReactNode;
  selected?: boolean;
  tone?: ButtonTone;
}) {
  return <Button iconOnly className={cn('h-7 w-7', className)} {...props}/>;
}
