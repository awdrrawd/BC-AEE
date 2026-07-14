import {t} from '@/i18n/i18n';
import cn from '@/util/cn';
import {Switch} from '@/components/ui/Switch';

export function ImportPendingRow({
  index,
  name,
  target,
  selected,
  onToggle,
  disabled = false,
}: {
  index: number;
  name?: string;
  target: number;
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const label = name?.trim() || `${t('wardrobe-import-outfit')}${index + 1}`;

  return <div
    className={cn(
      'flex h-10 shrink-0 items-center gap-3 rounded-md px-3 text-[22px] text-white',
      disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
      selected ? 'bg-[rgba(0,200,0,0.35)]' : 'bg-black/30',
    )}
    onClick={disabled ? undefined : onToggle}
  >
    <span onClick={event => event.stopPropagation()}>
      <Switch checked={selected} disabled={disabled} onChange={onToggle} ariaLabel={label} size="md"/>
    </span>
    <span className="truncate">
      {label}{target >= 0 ? `${t('wardrobe-import-slot')}${target + 1}` : ` - ${t('wardrobe-no-slot-selected')}`}
    </span>
  </div>;
}
