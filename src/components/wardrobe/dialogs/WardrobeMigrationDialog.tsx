import {Archive, ChevronDown, ChevronRight, DatabaseBackup, LogOut, Save} from 'lucide-react';
import {useMemo, useState} from 'react';
import {t} from '@/i18n/i18n';
import cn from '@/util/cn';
import type {WardrobeSourceId} from '@/core/types';
import {wardrobeSourceById} from '@/core/wardrobeStorage';
import {backupWardrobeSource} from '@/core/wardrobeFile';
import {
  applyWardrobeMigration,
  buildWardrobeMigrationOutfit,
  scanWardrobeMigration,
  type WardrobeMigrationMode,
  type WardrobeMigrationPart,
  type WardrobeMigrationSlot,
} from '@/core/wardrobeMigration';
import {bumpWardrobeData, getTargetCharacter, useWardrobeStore} from '@/core/wardrobeStore';
import {settings} from '@/core/settings';
import {showToast} from '@/util/toast';
import {CharacterPreview} from '@/components/wardrobe/CharacterPreview';
import {Button} from '@/components/ui/Button';
import {Dialog} from '@/components/ui/Dialog';

const SOURCES: WardrobeSourceId[] = ['online', 'local', 'sps'];
const MODES: WardrobeMigrationMode[] = ['none', 'aee', 'lscg'];
const GRID = 'grid-cols-[34px_76px_minmax(120px,1fr)_86px_68px_76px_64px]';

function partKey(slot: number, part: WardrobeMigrationPart): string {
  return `${slot}:${part.bundleIndex}`;
}

export function WardrobeMigrationDialog({onClose}: { onClose: () => void }) {
  const {dataVersion} = useWardrobeStore();
  const [sourceId, setSourceId] = useState<WardrobeSourceId>('online');
  const source = wardrobeSourceById(sourceId);
  const family = getTargetCharacter().AssetFamily;
  const slots = useMemo(() => {
    void dataVersion;
    return scanWardrobeMigration(source, family);
  }, [source, family, dataVersion]);
  const [choices, setChoices] = useState<Record<string, WardrobeMigrationMode>>({});
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [focusSlot, setFocusSlot] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const focused = slots.find(slot => slot.index === focusSlot) ?? slots[0] ?? null;
  const spsEnabled = settings.wardrobeSpsEnabled.get();

  const modeOf = (slot: WardrobeMigrationSlot, part: WardrobeMigrationPart) =>
    choices[partKey(slot.index, part)] ?? 'aee';
  const chosenParts = slots.reduce((count, slot) =>
    count + slot.parts.filter(part => modeOf(slot, part) !== 'none').length, 0);
  const chosenOutfits = slots.filter(slot => slot.parts.some(part => modeOf(slot, part) !== 'none')).length;
  const focusedAfter = focused
    ? buildWardrobeMigrationOutfit(focused, family, part => modeOf(focused, part))
    : null;

  const chooseSource = (id: WardrobeSourceId) => {
    if (id === 'sps' && !spsEnabled) return;
    wardrobeSourceById(id).reload();
    setSourceId(id);
    setChoices({});
    setExpanded(new Set());
    setFocusSlot(null);
  };
  const setPartMode = (slot: WardrobeMigrationSlot, part: WardrobeMigrationPart, mode: WardrobeMigrationMode) =>
    setChoices(previous => ({...previous, [partKey(slot.index, part)]: mode}));
  const setSlotMode = (slot: WardrobeMigrationSlot, mode: WardrobeMigrationMode) =>
    setChoices(previous => {
      const next = {...previous};
      for (const part of slot.parts) next[partKey(slot.index, part)] = mode === 'lscg' && !part.supportsLscg ? 'none' : mode;
      return next;
    });
  const toggleExpanded = (index: number) => setExpanded(previous => {
    const next = new Set(previous);
    if (next.has(index)) next.delete(index); else next.add(index);
    return next;
  });

  const migrate = (backup: boolean) => {
    const chosen = slots.flatMap(slot => {
      if (!slot.parts.some(part => modeOf(slot, part) !== 'none')) return [];
      return [{...slot, after: buildWardrobeMigrationOutfit(slot, family, part => modeOf(slot, part))}];
    });
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
        {SOURCES.map(id => <Button key={id} density="stage" className="h-12"
          selected={sourceId === id} disabled={id === 'sps' && !spsEnabled}
          onClick={() => chooseSource(id)}>{t(`wardrobe-source-${id}-short`)}</Button>)}
      </div>
      <h1 className="flex-1 text-center text-[28px] text-[#f0eee4]">{t('wardrobe-migration-title')}</h1>
      <Button density="stage" className="h-15 w-22.5" onClick={onClose} icon={<LogOut className="h-6 w-6"/>}
              aria-label={t('wardrobe-cancel')}/>
    </header>

    <div className="flex min-h-0 flex-1 gap-5">
      <MigrationPreview before={focused?.before} after={focusedAfter}/>
      <section className="flex min-h-0 flex-1 flex-col gap-2">
        <h2 className="shrink-0 text-[24px] text-white">{t('wardrobe-migration-list', {n: chosenParts})}</h2>
        <div className="aee-scroll flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto rounded-xl border border-white/20 p-2">
          <div className={cn('sticky top-0 z-10 grid shrink-0 items-center gap-2 border-b border-white/20 bg-zinc-950 px-2 py-2 text-center text-[25px] leading-none text-white', GRID)}>
            <span/>
            <span>{t('wardrobe-migration-column-label')}</span>
            <span className="text-left">{t('wardrobe-migration-column-name')}</span>
            <span>{t('wardrobe-migration-mode-none')}</span>
            <span>AEE</span>
            <span>LSCG</span>
            <span>{t('wardrobe-migration-column-total')}</span>
          </div>
          {slots.length ? slots.map(slot => <MigrationSlotRow
            key={slot.index} slot={slot} focused={focused?.index === slot.index}
            open={expanded.has(slot.index)} modeOf={part => modeOf(slot, part)}
            onFocus={() => setFocusSlot(slot.index)} onToggle={() => toggleExpanded(slot.index)}
            onPartMode={(part, mode) => setPartMode(slot, part, mode)}
            onSlotMode={mode => setSlotMode(slot, mode)}
          />) : <p className="m-auto px-6 text-center text-[22px] text-zinc-500">{t('wardrobe-migration-empty')}</p>}
        </div>
      </section>
    </div>

    <Button density="stage" className="mx-auto mt-4 h-12.5 w-145 shrink-0" tone="primary"
            disabled={chosenParts === 0} onClick={() => setConfirming(true)} icon={<Save className="h-5 w-5"/>}>
      {t('wardrobe-migration-apply', {n: chosenOutfits})}
    </Button>
    {confirming ? <Confirmation onCancel={() => setConfirming(false)} onMigrate={migrate}/> : null}
  </Dialog>;
}

function MigrationSlotRow({slot, focused, open, modeOf, onFocus, onToggle, onPartMode, onSlotMode}: {
  slot: WardrobeMigrationSlot;
  focused: boolean;
  open: boolean;
  modeOf: (part: WardrobeMigrationPart) => WardrobeMigrationMode;
  onFocus: () => void;
  onToggle: () => void;
  onPartMode: (part: WardrobeMigrationPart, mode: WardrobeMigrationMode) => void;
  onSlotMode: (mode: WardrobeMigrationMode) => void;
}) {
  const counts = Object.fromEntries(MODES.map(mode => [mode, slot.parts.filter(part => modeOf(part) === mode).length]));
  return <div className={cn('shrink-0 overflow-hidden rounded-lg border', focused ? 'border-(--aee-accent)' : 'border-white/8')}>
    <div className={cn('grid cursor-pointer items-center gap-2 bg-white/3 px-2 py-2 text-center', GRID)}
         role="button" tabIndex={0} onClick={onFocus}
         onKeyDown={event => (event.key === 'Enter' || event.key === ' ') && onFocus()}>
      <button className="flex items-center justify-center text-white" onClick={event => {event.stopPropagation(); onToggle();}}
              aria-label={t('wardrobe-toggle-list')}>
        {open ? <ChevronDown className="h-6 w-6"/> : <ChevronRight className="h-6 w-6"/>}
      </button>
      <span className="font-mono text-[26px] leading-none text-white">#{slot.index + 1}</span>
      <span className="truncate text-left text-[27px] leading-none text-white">{slot.name.trim() || t('wardrobe-import-slot-untitled')}</span>
      {MODES.map(mode => <button key={mode} className={cn('flex items-center justify-center rounded px-1 text-[25px] leading-none', counts[mode] ? 'text-white' : 'text-zinc-600')}
        onClick={event => {event.stopPropagation(); onSlotMode(mode); onFocus();}}>{counts[mode]}</button>)}
      <span className="text-[26px] leading-none text-white">{slot.parts.length}</span>
    </div>
    {open ? <div className="border-t border-white/10">
      {slot.parts.map(part => {
        const asset = AssetGet(getTargetCharacter().AssetFamily, part.group, part.name);
        return <div key={part.bundleIndex} className={cn('grid items-center gap-2 border-b border-white/5 px-2 py-2 text-center last:border-b-0', GRID)}>
          <span/>
          <span className="truncate text-[23px] leading-none text-zinc-300">{asset?.Group.Description ?? part.group}</span>
          <span className="truncate text-left text-[25px] leading-none text-zinc-200">{asset?.Description ?? part.name}</span>
          {MODES.map(mode => <label key={mode} className="flex cursor-pointer justify-center">
            <input type="radio" name={`migration-${slot.index}-${part.bundleIndex}`} checked={modeOf(part) === mode}
                   disabled={mode === 'lscg' && !part.supportsLscg}
                   onChange={() => onPartMode(part, mode)} className="h-4 w-4 accent-(--aee-accent)"/>
          </label>)}
          <span className="text-[24px] leading-none text-white">{part.layers}</span>
        </div>;
      })}
    </div> : null}
  </div>;
}

function MigrationPreview({before, after}: {before?: readonly ItemBundle[]; after: readonly ItemBundle[] | null}) {
  return <section className="flex w-245 shrink-0 flex-col gap-2">
    <h2 className="shrink-0 text-center text-[24px] text-white">{t('wardrobe-import-preview')}</h2>
    <div className="relative grid min-h-0 flex-1 grid-cols-2 gap-3 rounded-xl border border-white/20 p-3">
      <Preview title={t('wardrobe-migration-before')} appearance={before}/>
      <Preview title={t('wardrobe-migration-after')} appearance={after} highlight/>
      {before ? <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-(--aee-accent-55) bg-zinc-950/90 px-2 py-1 text-xl text-(--aee-accent)">➤</span> : null}
    </div>
  </section>;
}

function Preview({title, appearance, highlight = false}: {title: string; appearance?: readonly ItemBundle[] | null; highlight?: boolean}) {
  return <div className={cn('flex min-h-0 flex-col overflow-hidden rounded-xl border bg-black/30', highlight ? 'border-(--aee-accent)' : 'border-white/10')}>
    <div className="shrink-0 border-b border-white/10 px-2 py-1 text-center text-[20px] text-white">{title}</div>
    {appearance?.length ? <CharacterPreview appearance={appearance}
      className="min-h-0 min-w-0 flex-1 overflow-hidden [&>canvas]:block [&>canvas]:max-h-full [&>canvas]:max-w-full [&>canvas]:object-contain"/>
      : <p className="m-auto text-[20px] text-zinc-500">—</p>}
  </div>;
}

function Confirmation({onCancel, onMigrate}: {onCancel: () => void; onMigrate: (backup: boolean) => void}) {
  return <div className="absolute inset-0 z-10 flex items-center justify-center rounded-(--aee-panel-radius) bg-black/85 p-8">
    <div className="flex w-250 flex-col gap-5 rounded-xl border border-amber-400/50 bg-zinc-950 p-6 text-center shadow-2xl">
      <Archive className="mx-auto h-12 w-12 text-amber-300"/>
      <h2 className="text-[28px] text-amber-200">{t('wardrobe-migration-warning-title')}</h2>
      <p className="text-[22px] leading-relaxed text-zinc-200">{t('wardrobe-migration-warning')}</p>
      <div className="flex justify-center gap-3">
        <Button density="stage" className="h-12" tone="primary" onClick={() => onMigrate(true)}
                icon={<DatabaseBackup className="h-5 w-5"/>}>{t('wardrobe-migration-backup-apply')}</Button>
        <Button density="stage" className="h-12" tone="danger" onClick={() => onMigrate(false)}
                icon={<Save className="h-5 w-5"/>}>{t('wardrobe-migration-apply-only')}</Button>
        <Button density="stage" className="h-12" onClick={onCancel}>{t('wardrobe-cancel')}</Button>
      </div>
    </div>
  </div>;
}
