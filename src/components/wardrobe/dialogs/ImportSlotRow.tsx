import {t} from '@/i18n/i18n';
import cn from '@/util/cn';
import {isSlotOccupied, slotName} from '@/controllers/outfitsController';

export function ImportSlotRow({index, isTarget}: { index: number; isTarget: boolean }) {
  return <div
    className={cn(
      'flex h-10 shrink-0 items-center rounded-md px-3 text-[22px] text-white',
      isTarget ? 'bg-[rgba(255,180,0,0.4)]' : isSlotOccupied(index) ? 'bg-black/50' : 'bg-black/20',
    )}
  >
    <span className="tabular-nums text-white/60">#{index + 1}</span>
    <span className="ml-2 truncate">{slotName(index)}</span>
    {isTarget ? <span className="ml-auto shrink-0">{t('wardrobe-import-target')}</span> : null}
  </div>;
}
