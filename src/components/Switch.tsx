import type {ReactNode} from 'react';

type SwitchSize = 'sm' | 'md';

const switchSizeClass: Record<SwitchSize, { track: string; thumb: string; checkedThumbOffset: number }> = {
  sm: {
    track: 'h-[18px] w-[34px]',
    thumb: 'h-3.5 w-3.5',
    checkedThumbOffset: 16,
  },
  md: {
    track: 'h-5 w-9',
    thumb: 'h-4 w-4',
    checkedThumbOffset: 16,
  },
};

export function Switch({
                         checked,
                         onChange,
                         ariaLabel,
                         size = 'sm',
                         disabled = false,
                         className = '',
                         children,
                       }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
  size?: SwitchSize;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const sizeClass = switchSizeClass[size];

  return <label
    className={`inline-flex shrink-0 items-center gap-1.5 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${className}`}>
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
      className={`${sizeClass.track} inline-flex shrink-0 items-center rounded-full border p-0.5 transition-colors ${
        checked ? 'border-violet-400 bg-violet-500 ring-1 ring-inset ring-white/15' : 'border-zinc-600 bg-zinc-800'
      } peer-focus-visible:ring-2 peer-focus-visible:ring-violet-300/70 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-zinc-950`}
      aria-hidden="true"
    >
      <span
        className={`${sizeClass.thumb} block rounded-full bg-white shadow-sm transition-transform`}
        style={{transform: `translateX(${checked ? sizeClass.checkedThumbOffset : 0}px)`}}
      />
    </span>
    {children}
  </label>;
}
