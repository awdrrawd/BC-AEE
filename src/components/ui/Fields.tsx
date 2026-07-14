import {forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes} from 'react';
import cn from '@/util/cn';

type FieldDensity = 'compact' | 'stage';

const densityClass: Record<FieldDensity, string> = {
  compact: 'h-7 px-2 text-xs',
  stage: 'h-11 px-3 text-[20px]',
};

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & {
  density?: FieldDensity;
}>(function TextInput({density = 'compact', className, ...props}, ref) {
  return <input
    ref={ref}
    className={cn(
      'rounded-(--aee-panel-radius) border border-(--aee-accent-55) bg-(--aee-field-bg) text-(--aee-text-strong) outline-none',
      'caret-(--aee-accent) placeholder:text-white/35 focus:border-(--aee-accent)',
      densityClass[density],
      className,
    )}
    {...props}
  />;
});

export function Select({density = 'compact', className, children, ...props}: SelectHTMLAttributes<HTMLSelectElement> & {
  density?: FieldDensity;
  children: ReactNode;
}) {
  return <select
    className={cn(
      'rounded-(--aee-panel-radius) border border-(--aee-accent-55) bg-(--aee-field-bg) text-(--aee-text) outline-none focus:border-(--aee-accent)',
      densityClass[density],
      className,
    )}
    {...props}
  >{children}</select>;
}

export function ColorInput({value, onColorChange, ariaLabel, className, children}: {
  value: string;
  onColorChange: (color: string) => void;
  ariaLabel: string;
  className?: string;
  children?: ReactNode;
}) {
  return <label
    className={cn('relative flex cursor-pointer items-center justify-center overflow-hidden rounded-(--aee-panel-radius) border border-(--aee-accent-55) transition hover:brightness-110', className)}
    style={{backgroundColor: value}}
  >
    <input
      type="color"
      value={value}
      aria-label={ariaLabel}
      onChange={event => onColorChange(event.currentTarget.value)}
      className="absolute inset-0 cursor-pointer opacity-0"
    />
    {children}
  </label>;
}

export function FileInput({accept, onSelect, ariaLabel, className, children}: {
  accept: string;
  onSelect: (file: File) => void;
  ariaLabel: string;
  className?: string;
  children: ReactNode;
}) {
  return <label className={cn('relative cursor-pointer', className)}>
    <input
      type="file"
      accept={accept}
      aria-label={ariaLabel}
      onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) onSelect(file);
      }}
      className="absolute inset-0 cursor-pointer opacity-0"
    />
    {children}
  </label>;
}

export function ColorSwatch({color, className, label, checkerboard = false, onClick}: {
  color: string;
  className?: string;
  label?: string;
  checkerboard?: boolean;
  onClick: () => void;
}) {
  return <button
    type="button"
    className={cn(
      'group relative overflow-hidden rounded-(--aee-panel-radius) border border-zinc-700 transition hover:border-(--aee-accent)',
      checkerboard && 'bg-[repeating-conic-gradient(#222_0%_25%,#111_0%_50%)] bg-size-[6px_6px]',
      className,
    )}
    onClick={onClick}
  >
    <span className="absolute inset-0" style={{background: color}}/>
    {label ? <span
      className="absolute inset-x-0 bottom-0 text-center font-mono text-[9px] text-white opacity-0 [text-shadow:0_1px_2px_rgba(0,0,0,.8)] group-hover:opacity-100"
    >{label}</span> : null}
  </button>;
}
