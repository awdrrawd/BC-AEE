import type {ReactNode} from 'react';
import cn from '@/util/cn';

type SwitchSize = 'sm' | 'md';

const sizes: Record<SwitchSize, { track: string; thumb: string; offset: number }> = {
  sm: {track: 'h-[18px] w-[34px]', thumb: 'h-3.5 w-3.5', offset: 16},
  md: {track: 'h-5 w-9', thumb: 'h-4 w-4', offset: 16},
};

export function Switch({checked, onChange, ariaLabel, size = 'sm', disabled = false, className, children}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
  size?: SwitchSize;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const dimensions = sizes[size];
  return <label
    className={cn('inline-flex shrink-0 items-center gap-1.5', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer', className)}>
    <input
      className="peer sr-only"
      type="checkbox"
      role="switch"
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={event => onChange(event.currentTarget.checked)}
    />
    <span
      className={cn(
        dimensions.track,
        'inline-flex shrink-0 items-center rounded-full border p-0.5 transition-colors',
        checked ? 'border-(--aee-accent) bg-(--aee-accent-65)' : 'border-zinc-600 bg-zinc-800',
        'peer-focus-visible:ring-2 peer-focus-visible:ring-(--aee-accent-55)',
      )}
      aria-hidden="true"
    >
      <span
        className={cn(dimensions.thumb, 'block rounded-full bg-white shadow-sm transition-transform')}
        style={{transform: `translateX(${checked ? dimensions.offset : 0}px)`, willChange: 'transform'}}
      />
    </span>
    {children}
  </label>;
}
