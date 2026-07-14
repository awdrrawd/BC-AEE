import {t} from '@/i18n/i18n';
import cn from '@/util/cn';
import {slotName} from '@/controllers/outfitsController';
import type {ImportEntry, ImportStatus} from '@/components/wardrobe/dialogs/importPlan';
import {entryStatus, outfitLabel, slotLabel} from '@/components/wardrobe/dialogs/importPlan';
import {Select} from '@/components/ui/Fields';
import {Switch} from '@/components/ui/Switch';

const STATUS_STYLE: Record<ImportStatus, { sign: string; text: string; bar: string; bg: string }> = {
  add: {sign: '+', text: 'text-emerald-300', bar: 'bg-emerald-400', bg: 'bg-emerald-500/10'},
  replace: {sign: '~', text: 'text-amber-300', bar: 'bg-amber-400', bg: 'bg-amber-500/10'},
  skip: {sign: '−', text: 'text-zinc-500', bar: 'bg-zinc-600', bg: 'bg-white/2'},
};

export function ImportChangeRow({entry, index, focused, onFocus, onToggle, onRetarget}: {
  entry: ImportEntry;
  index: number;
  focused: boolean;
  onFocus: () => void;
  onToggle: () => void;
  onRetarget: (target: number) => void;
}) {
  const status = entryStatus(entry);
  const style = STATUS_STYLE[status];
  const label = outfitLabel(entry, index);
  const replaced = status === 'replace' ? slotName(entry.target).trim() : '';

  return <div
    role="button"
    tabIndex={0}
    onClick={onFocus}
    onKeyDown={event => {
      if (event.key === 'Enter' || event.key === ' ') onFocus();
    }}
    className={cn(
      'flex shrink-0 cursor-pointer items-center gap-3 overflow-hidden rounded-lg border py-2 pr-3 transition-colors',
      style.bg,
      focused ? 'border-(--aee-accent)' : 'border-white/8 hover:border-white/20',
    )}
  >
    <span className={cn('h-12 w-1.5 shrink-0 rounded-r', style.bar)}/>

    <span onClick={event => event.stopPropagation()}>
      <Switch checked={entry.selected} disabled={entry.target < 0} onChange={onToggle} ariaLabel={label} size="md"/>
    </span>

    <span className={cn('w-5 shrink-0 text-center font-mono text-[26px] font-bold', style.text)}>{style.sign}</span>

    <span className="flex min-w-0 flex-1 flex-col">
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-[22px] text-white">{label}</span>
        <span className="shrink-0 text-[18px] text-zinc-500">
          {t('wardrobe-import-items', {n: entry.pending.outfit.length})}
        </span>
      </span>

      <span className={cn('truncate text-[18px]', style.text)}>
        {status === 'skip' ? t('wardrobe-import-status-skip')
          : status === 'add' ? t('wardrobe-import-status-add', {slot: entry.target + 1})
            : t('wardrobe-import-status-replace', {
              slot: entry.target + 1,
              name: replaced || t('wardrobe-import-slot-untitled'),
            })}
      </span>
    </span>

    <span onClick={event => event.stopPropagation()}>
      <Select
        density="stage"
        className="w-70 text-[18px]"
        value={entry.target}
        aria-label={t('wardrobe-import-target-label')}
        onChange={event => onRetarget(Number(event.currentTarget.value))}
      >
        <option value={-1}>{t('wardrobe-import-no-target')}</option>
        {Array.from({length: WardrobeSize}, (_, slot) => <option key={slot} value={slot}>{slotLabel(slot)}</option>)}
      </Select>
    </span>
  </div>;
}