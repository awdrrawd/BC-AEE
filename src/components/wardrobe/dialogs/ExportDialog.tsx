import {Check, LogOut, Upload} from 'lucide-react';
import {useMemo, useState} from 'react';
import {t} from '@/i18n/i18n';
import cn from '@/util/cn';
import {exportSelectedSlotsToFile} from '@/controllers/outfitsController';
import {collectWardrobeSlots} from '@/core/wardrobeFile';
import {CharacterPreview} from '@/components/wardrobe/CharacterPreview';
import {Button} from '@/components/ui/Button';
import {Dialog} from '@/components/ui/Dialog';
import {Switch} from '@/components/ui/Switch';

export function ExportDialog({onClose}: { onClose: () => void }) {
  const slots = useMemo(() => collectWardrobeSlots(), []);
  const [selected, setSelected] = useState<Set<number>>(() => new Set(slots.map(slot => slot.index)));
  const [focus, setFocus] = useState(0);

  const toggle = (index: number) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(index)) next.delete(index); else next.add(index);
    return next;
  });

  const allOn = slots.length > 0 && slots.every(slot => selected.has(slot.index));
  const toggleAll = () => setSelected(allOn ? new Set() : new Set(slots.map(slot => slot.index)));

  const confirm = () => {
    exportSelectedSlotsToFile(selected);
    onClose();
  };

  const focused = slots[focus] ?? null;

  return <Dialog onDismiss={onClose} className="h-240 w-490 p-6">
    <header className="mb-4 flex shrink-0 items-center gap-4">
      <Button density="stage" className="h-15" disabled={!slots.length} onClick={toggleAll}
              icon={<Check className="h-6 w-6"/>}
      >{t('wardrobe-import-toggle-all')}</Button>

      <h1 className="flex-1 text-center text-[28px] text-[#f0eee4]">{t('wardrobe-export-title')}</h1>

      <Button density="stage" className="h-15 w-22.5" onClick={onClose} icon={<LogOut className="h-6 w-6"/>}
              aria-label={t('wardrobe-cancel')}/>
    </header>

    <div className="flex min-h-0 flex-1 gap-5">
      <section className="flex min-h-0 flex-1 flex-col gap-2">
        <h2 className="shrink-0 text-[24px] text-white">{t('wardrobe-export-list', {n: selected.size})}</h2>

        <div
          className="aee-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto rounded-xl border border-white/20 p-2">
          {slots.length
            ? slots.map((slot, index) => {
              const on = selected.has(slot.index);
              return <div
                key={slot.index}
                role="button"
                tabIndex={0}
                onClick={() => setFocus(index)}
                onKeyDown={event => (event.key === 'Enter' || event.key === ' ') && setFocus(index)}
                className={cn(
                  'flex shrink-0 cursor-pointer items-center gap-3 overflow-hidden rounded-lg border py-2 pr-3 pl-3 transition-colors',
                  index === focus ? 'border-(--aee-accent)' : 'border-white/8 hover:border-white/20',
                  !on && 'opacity-45',
                )}
              >
                <span onClick={event => event.stopPropagation()}>
                  <Switch checked={on} onChange={() => toggle(slot.index)} ariaLabel={slot.name} size="md"/>
                </span>
                <span className="w-10 shrink-0 text-center font-mono text-[20px] text-zinc-500">#{slot.index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[22px] text-white">
                  {slot.name.trim() || t('wardrobe-import-slot-untitled')}
                </span>
                <span className="shrink-0 text-[18px] text-zinc-500">
                  {t('wardrobe-import-items', {n: slot.outfit.length})}
                </span>
              </div>;
            })
            : <p className="m-auto px-6 text-center text-[22px] text-zinc-500">{t('wardrobe-toast-file-empty')}</p>}
        </div>
      </section>

      <section className="flex w-160 shrink-0 flex-col gap-2">
        <h2 className="shrink-0 text-center text-[24px] text-white">{t('wardrobe-import-preview')}</h2>
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-white/20 bg-black/30">
          {focused
            ? <CharacterPreview appearance={focused.outfit} className="min-h-0 flex-1"/>
            : <p className="m-auto px-6 text-center text-[22px] text-zinc-500">{t('wardrobe-import-preview-hint')}</p>}
        </div>
      </section>
    </div>

    <Button density="stage"
            className="mx-auto mt-4 h-12.5 w-145 shrink-0"
            tone="primary"
            disabled={selected.size === 0}
            onClick={confirm}
            icon={<Upload className="h-5 w-5"/>}
    >{t('wardrobe-export-count', {n: selected.size})}</Button>
  </Dialog>;
}
