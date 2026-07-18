import {type KeyboardEvent, useRef, useState} from 'react';
import {Plus, X} from 'lucide-react';
import {t} from '@/i18n/i18n';
import cn from '@/util/cn';
import {Button} from '@/components/ui/Button';
import {TextInput} from '@/components/ui/Fields';

type ListDensity = 'compact' | 'stage';

const SEPARATORS = /[,，、;；\n\t]/;
const MAX_ENTRY_LENGTH = 24;

const sizes: Record<ListDensity, {
  box: string;
  chip: string;
  remove: string;
  hint: string;
  input: string;
  add: string;
}> = {
  compact: {
    box: 'min-h-16 gap-1.5 p-2',
    chip: 'h-7 gap-1 pr-1 pl-2.5 text-xs',
    remove: 'h-4 w-4',
    hint: 'text-xs',
    input: 'h-9 flex-1 px-2 text-sm',
    add: 'h-9 w-9',
  },
  stage: {
    box: 'min-h-28 gap-2 p-3',
    chip: 'h-11 gap-2 pr-2 pl-4 text-[20px]',
    remove: 'h-6 w-6',
    hint: 'text-[18px]',
    input: 'h-14 flex-1 px-4 text-[24px]',
    add: 'h-14 w-14',
  },
};

function normalise(entry: string): string {
  return entry.trim().slice(0, MAX_ENTRY_LENGTH);
}

export function ListEditor({values, suggestions, placeholder, density = 'compact', autoFocus = true, onChange, onCancel}: {
  values: string[];
  suggestions?: string[];
  placeholder?: string;
  density?: ListDensity;
  autoFocus?: boolean;
  onChange: (values: string[]) => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const size = sizes[density];

  const has = (entry: string) => values.some(value => value.toLowerCase() === entry.toLowerCase());

  const add = (raw: string) => {
    const added = raw.split(SEPARATORS).map(normalise).filter(Boolean);
    const next = [...values];
    for (const entry of added) {
      if (!next.some(value => value.toLowerCase() === entry.toLowerCase())) next.push(entry);
    }
    if (next.length !== values.length) onChange(next);
    setDraft('');
    inputRef.current?.focus();
  };

  const remove = (index: number) => {
    onChange(values.filter((_, at) => at !== index));
    inputRef.current?.focus();
  };

  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && draft.trim()) {
      event.preventDefault();
      event.stopPropagation();
      add(draft);
    } else if (event.key === 'Backspace' && !draft && values.length) {
      event.preventDefault();
      remove(values.length - 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (draft) setDraft('');
      else onCancel?.();
    }
  };

  const unused = (suggestions ?? []).filter(entry => !has(entry));

  return <div className="flex flex-col gap-2">
    <div className={cn(
      'flex flex-wrap content-start items-start rounded-(--aee-panel-radius) border border-(--aee-accent-55) bg-(--aee-field-bg)',
      size.box,
    )}>
      {values.length ? values.map((value, index) => <span
        key={`${value}-${index}`}
        className={cn(
          'inline-flex max-w-full items-center rounded-full border border-(--aee-accent) bg-(--aee-accent-22) text-(--aee-text-strong)',
          size.chip,
        )}
      >
        <span className="min-w-0 truncate">{value}</span>
        <button
          type="button"
          aria-label={t('wardrobe-list-remove', {name: value})}
          onClick={() => remove(index)}
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full text-(--aee-text-muted) transition-colors',
            'hover:bg-(--aee-accent-35) hover:text-(--aee-text-strong)',
            size.remove,
          )}
        ><X className="h-[70%] w-[70%]"/></button>
      </span>) : <span className={cn('text-white/35', size.hint)}>{t('wardrobe-list-empty')}</span>}
    </div>

    <div className="flex gap-2">
      <TextInput
        ref={inputRef}
        density={density}
        type="text"
        value={draft}
        autoFocus={autoFocus}
        placeholder={placeholder ?? t('wardrobe-list-placeholder')}
        onChange={event => setDraft(event.currentTarget.value)}
        onKeyDown={keyDown}
        className={cn('min-w-0', size.input)}
      />
      <Button
        density={density}
        iconOnly
        disabled={!draft.trim()}
        aria-label={t('wardrobe-list-add')}
        onClick={() => add(draft)}
        icon={<Plus className="h-[55%] w-[55%]"/>}
        className={size.add}
      />
    </div>

    {unused.length ? <div className="flex flex-wrap items-center gap-1.5">
      <span className={cn('text-(--aee-text-muted)', size.hint)}>{t('wardrobe-list-suggestions')}</span>
      {unused.map(entry => <Button
        key={entry}
        density={density}
        tone="ghost"
        className={cn('rounded-full border border-(--aee-accent-22)', size.chip)}
        onClick={() => add(entry)}
      >{entry}</Button>)}
    </div> : null}
  </div>;
}