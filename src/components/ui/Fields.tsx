import {
  Children, forwardRef, isValidElement, type CSSProperties, type InputHTMLAttributes, type OptionHTMLAttributes,
  type ReactElement, type ReactNode, useEffect, useRef, useState,
} from 'react';
import cn from '@/util/cn';
import {Check, ChevronDown} from 'lucide-react';

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

export function Select({density = 'compact', className, children, value, onValueChange, disabled, ariaLabel, style}: {
  density?: FieldDensity;
  children: ReactNode;
  value: string | number;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const options = Children.toArray(children)
    .filter((child): child is ReactElement<OptionHTMLAttributes<HTMLOptionElement> & {'data-color'?: string}> => isValidElement(child) && child.type === 'option')
    .map(child => ({
      value: String(child.props.value ?? ''),
      label: child.props.children,
      disabled: !!child.props.disabled,
      color: child.props['data-color'],
    }));
  const selected = options.find(option => option.value === String(value)) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (rootRef.current && event.composedPath().includes(rootRef.current)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [open]);

  const move = (delta: number) => {
    if (!options.length) return;
    let index = Math.max(0, options.findIndex(option => option.value === String(value)));
    for (let count = 0; count < options.length; count++) {
      index = (index + delta + options.length) % options.length;
      if (!options[index].disabled) {
        onValueChange(options[index].value);
        break;
      }
    }
  };

  return <div ref={rootRef}
    className={cn(
      'relative inline-flex min-w-0 rounded-(--aee-panel-radius)',
      className,
    )}
    style={style}>
    <button type="button" disabled={disabled} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open}
      onClick={() => setOpen(current => !current)}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          move(event.key === 'ArrowDown' ? 1 : -1);
          setOpen(true);
        } else if (event.key === 'Escape') setOpen(false);
      }}
      className={cn(
        'flex w-full min-w-0 items-center justify-between gap-2 rounded-(--aee-panel-radius) border-2 border-(--aee-accent-55) bg-(--aee-field-bg) text-left text-(--aee-text) outline-none transition',
        'hover:border-(--aee-accent) hover:bg-(--aee-accent-16) focus-visible:border-(--aee-accent) focus-visible:ring-2 focus-visible:ring-(--aee-accent-35) disabled:cursor-not-allowed disabled:opacity-45',
        densityClass[density],
      )}>
      {selected?.color ? <span className="h-4 w-4 shrink-0 rounded border border-white/35" style={{backgroundColor: selected.color}}/> : null}
      <span className="min-w-0 flex-1 truncate">{selected?.label}</span>
      <ChevronDown className={cn('h-4 w-4 shrink-0 text-(--aee-accent) transition-transform', open && 'rotate-180')}/>
    </button>
    {open ? <div role="listbox" aria-label={ariaLabel}
      className={cn(
        'aee-pop-in absolute right-0 top-[calc(100%+4px)] z-1000010 max-h-72 min-w-[calc(100%+100px)] overflow-y-auto rounded-(--aee-panel-radius) border-2 border-(--aee-accent-55) bg-(--aee-panel-bg) p-1 shadow-(--aee-panel-shadow)',
        density === 'stage' ? 'text-[20px]' : 'text-xs',
      )}>
      {options.map(option => <button key={option.value} type="button" role="option"
        aria-selected={option.value === String(value)} disabled={option.disabled}
        onClick={() => { onValueChange(option.value); setOpen(false); }}
        className={cn(
          'flex w-full items-center gap-2 whitespace-nowrap rounded px-2 text-left transition',
          density === 'stage' ? 'min-h-10' : 'min-h-7',
          option.value === String(value)
            ? 'bg-(--aee-accent-22) text-(--aee-accent)'
            : 'text-(--aee-text) hover:bg-(--aee-accent-16) hover:text-(--aee-text-strong)',
          option.disabled && 'opacity-40',
        )}>
        {option.color ? <span className="h-4 w-4 shrink-0 rounded border border-white/35" style={{backgroundColor: option.color}}/> : null}
        <span className="flex-1">{option.label}</span>
        <Check className={cn('h-3.5 w-3.5 shrink-0', option.value === String(value) ? 'opacity-100' : 'opacity-0')}/>
      </button>)}
    </div> : null}
  </div>;
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
  return <label className={cn('relative cursor-pointer transition hover:brightness-110', className)}>
    <input
      type="file"
      accept={accept}
      aria-label={ariaLabel}
      onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) onSelect(file);
      }}
      className="absolute inset-0 z-10 cursor-pointer opacity-0"
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
