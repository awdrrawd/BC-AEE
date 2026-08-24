import {Archive, Check, DatabaseBackup, LogOut, Save} from 'lucide-react';
import {useMemo, useState} from 'react';
import {t} from '@/i18n/i18n';
import cn from '@/util/cn';
import type {WardrobeSourceId} from '@/core/types';
import {wardrobeSourceById} from '@/core/wardrobeStorage';
import {backupWardrobeSource} from '@/core/wardrobeFile';
import {applyWardrobeMigration, scanWardrobeMigration} from '@/core/wardrobeMigration';
import {bumpWardrobeData, getTargetCharacter, useWardrobeStore} from '@/core/wardrobeStore';
import {settings} from '@/core/settings';
import {showToast} from '@/util/toast';
import {CharacterPreview} from '@/components/wardrobe/CharacterPreview';
import {Button} from '@/components/ui/Button';
import {Dialog} from '@/components/ui/Dialog';
import {Switch} from '@/components/ui/Switch';

const SOURCES: WardrobeSourceId[] = ['online', 'local', 'sps'];

export function WardrobeMigrationDialog({onClose}: { onClose: () => void }) {
  const {dataVersion} = useWardrobeStore();
  const [sourceId, setSourceId] = useState<WardrobeSourceId>('online');
  const source = wardrobeSourceById(sourceId);
  const slots = useMemo(
    () => {
      void dataVersion; // rescan after an asynchronous local/SPS reload updates its memory mirror
      return scanWardrobeMigration(source, getTargetCharacter().AssetFamily);
    },
    [source, dataVersion],
  );
  const [selected, setSelected] = useState<Set<number> | null>(null);
  const [focusSlot, setFocusSlot] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  const selectedSlots = selected ?? new Set(slots.map(slot => slot.index));
  const focused = slots.find(slot => slot.index === focusSlot) ?? slots[0] ?? null;
  const spsEnabled = settings.wardrobeSpsEnabled.get();

  const chooseSource = (id: WardrobeSourceId) => {
    if (id === 'sps' && !spsEnabled) return;
    wardrobeSourceById(id).reload();
    setSourceId(id);
    setSelected(null);
    setFocusSlot(null);
  };

  const toggle = (index: number) => {
    const next = new Set(selectedSlots);
    if (next.has(index)) next.delete(index); else next.add(index);
    setSelected(next);
  };

  const toggleAll = () => setSelected(
    slots.length > 0 && slots.every(slot => selectedSlots.has(slot.index))
      ? new Set()
      : new Set(slots.map(slot => slot.index)),
  );

  const migrate = (backup: boolean) => {
    const chosen = slots.filter(slot => selectedSlots.has(slot.index));
    if (!chosen.length) return;
    try {
      if (backup && backupWardrobeSource(source) === 0) throw new Error('Wardrobe backup was empty');
      if (!applyWardrobeMigration(source, chosen)) throw new Error('Wardrobe persistence rejected the migration');
    } catch (error) {
      console.error('🐈‍⬛ [AEE] Failed to migrate wardrobe data', error);
      showToast(t('wardrobe-migration-failed'), {color: '#f87171'});
      setConfirming(false);
      return;
    }
    bumpWardrobeData();
    showToast(t('wardrobe-migration-complete', {n: chosen.length}));
    onClose();
  };

  return <Dialog onDismiss={onClose} className="h-240 w-490 p-6">
    <header className="mb-4 flex shrink-0 items-center gap-4">
      <div className="flex gap-2">
        {SOURCES.map(id => <Button
          key={id}
          density="stage"
          className="h-12"
          selected={sourceId === id}
          disabled={id === 'sps' && !spsEnabled}
          onClick={() => chooseSource(id)}
        >{t(`wardrobe-source-${id}-short`)}</Button>)}
      </div>
      <h1 className="flex-1 text-center text-[28px] text-[#f0eee4]">{t('wardrobe-migration-title')}</h1>
      <Button density="stage" className="h-15 w-22.5" onClick={onClose} icon={<LogOut className="h-6 w-6"/>}
              aria-label={t('wardrobe-cancel')}/>
    </header>

    <div className="flex min-h-0 flex-1 gap-5">
      <section className="flex w-245 shrink-0 flex-col gap-2">
        <h2 className="shrink-0 text-center text-[24px] text-white">{t('wardrobe-import-preview')}</h2>
        <div className="relative grid min-h-0 flex-1 grid-cols-2 gap-3 rounded-xl border border-white/20 p-3">
          <Preview title={t('wardrobe-migration-before')} appearance={focused?.before}/>
          <Preview title={t('wardrobe-migration-after')} appearance={focused?.after} highlight/>
          {focused ? <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-(--aee-accent-55) bg-zinc-950/90 px-2 py-1 text-xl text-(--aee-accent)">➤</span> : null}
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex shrink-0 items-center gap-3">
          <h2 className="flex-1 text-[24px] text-white">{t('wardrobe-migration-list', {n: selectedSlots.size})}</h2>
          <Button density="stage" className="h-9" disabled={!slots.length} onClick={toggleAll}
                  icon={<Check className="h-4 w-4"/>}>{t('wardrobe-import-toggle-all')}</Button>
        </div>
        <div className="aee-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto rounded-xl border border-white/20 p-2">
          {slots.length ? slots.map(slot => {
            const on = selectedSlots.has(slot.index);
            return <div key={slot.index} role="button" tabIndex={0}
                        onClick={() => setFocusSlot(slot.index)}
                        onKeyDown={event => (event.key === 'Enter' || event.key === ' ') && setFocusSlot(slot.index)}
                        className={cn(
                          'flex shrink-0 cursor-pointer items-center gap-3 overflow-hidden rounded-lg border py-2 pr-3 pl-3 transition-colors',
                          focused?.index === slot.index ? 'border-(--aee-accent)' : 'border-white/8 hover:border-white/20',
                          !on && 'opacity-45',
                        )}>
              <span onClick={event => event.stopPropagation()}>
                <Switch checked={on} onChange={() => toggle(slot.index)} ariaLabel={slot.name} size="md"/>
              </span>
              <span className="w-12 shrink-0 text-center font-mono text-[20px] text-white">#{slot.index + 1}</span>
              <span className="min-w-0 flex-1 truncate text-[22px] text-white">
                {slot.name.trim() || t('wardrobe-import-slot-untitled')}
              </span>
              <span className="shrink-0 text-[18px] text-white">
                {t('wardrobe-migration-items', {n: slot.changedItems})}
              </span>
            </div>;
          }) : <p className="m-auto px-6 text-center text-[22px] text-zinc-500">{t('wardrobe-migration-empty')}</p>}
        </div>
      </section>
    </div>

    <Button density="stage" className="mx-auto mt-4 h-12.5 w-145 shrink-0" tone="primary"
            disabled={selectedSlots.size === 0} onClick={() => setConfirming(true)}
            icon={<Save className="h-5 w-5"/>}>
      {t('wardrobe-migration-apply', {n: selectedSlots.size})}
    </Button>

    {confirming ? <div className="absolute inset-0 z-10 flex items-center justify-center rounded-(--aee-panel-radius) bg-black/85 p-8">
      <div className="flex w-250 flex-col gap-5 rounded-xl border border-amber-400/50 bg-zinc-950 p-6 text-center shadow-2xl">
        <Archive className="mx-auto h-12 w-12 text-amber-300"/>
        <h2 className="text-[28px] text-amber-200">{t('wardrobe-migration-warning-title')}</h2>
        <p className="text-[22px] leading-relaxed text-zinc-200">{t('wardrobe-migration-warning')}</p>
        <div className="flex justify-center gap-3">
          <Button density="stage" className="h-12" tone="primary" onClick={() => migrate(true)}
                  icon={<DatabaseBackup className="h-5 w-5"/>}>{t('wardrobe-migration-backup-apply')}</Button>
          <Button density="stage" className="h-12" tone="danger" onClick={() => migrate(false)}
                  icon={<Save className="h-5 w-5"/>}>{t('wardrobe-migration-apply-only')}</Button>
          <Button density="stage" className="h-12" onClick={() => setConfirming(false)}>{t('wardrobe-cancel')}</Button>
        </div>
      </div>
    </div> : null}
  </Dialog>;
}

function Preview({title, appearance, highlight = false}: {
  title: string;
  appearance: readonly ItemBundle[] | null | undefined;
  highlight?: boolean;
}) {
  return <div className={cn('flex min-h-0 flex-col overflow-hidden rounded-xl border bg-black/30',
    highlight ? 'border-(--aee-accent)' : 'border-white/10')}>
    <div className="shrink-0 border-b border-white/10 px-2 py-1 text-center text-[20px] text-white">{title}</div>
    {appearance?.length
      ? <CharacterPreview appearance={appearance}
                          className="min-h-0 min-w-0 flex-1 overflow-hidden [&>canvas]:block [&>canvas]:max-h-full [&>canvas]:max-w-full [&>canvas]:object-contain"/>
      : <p className="m-auto text-[20px] text-zinc-500">—</p>}
  </div>;
}
