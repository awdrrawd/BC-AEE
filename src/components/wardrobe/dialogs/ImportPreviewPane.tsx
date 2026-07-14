import {t} from '@/i18n/i18n';
import cn from '@/util/cn';
import type {ImportEntry} from '@/components/wardrobe/dialogs/importPlan';
import {entryStatus, outfitLabel, slotLabel} from '@/components/wardrobe/dialogs/importPlan';
import {CharacterPreview} from '@/components/wardrobe/CharacterPreview';

export function ImportPreviewPane({entry, index}: { entry: ImportEntry | null; index: number }) {
  return <section className="flex w-160 shrink-0 flex-col gap-2">
    <h2 className="shrink-0 text-center text-[24px] text-white">{t('wardrobe-import-preview')}</h2>

    <div className="aee-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-xl border border-white/20 p-3">
      {!entry
        ? <p className="m-auto px-6 text-center text-[22px] text-zinc-500">{t('wardrobe-import-preview-hint')}</p>
        : <>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
            <PreviewCard
              title={t('wardrobe-import-before')}
              subtitle={entry.target < 0 ? t('wardrobe-import-no-target') : slotLabel(entry.target)}
              appearance={entry.target >= 0 ? Player.Wardrobe?.[entry.target] : null}
            />
            <PreviewCard
              title={t('wardrobe-import-after')}
              subtitle={outfitLabel(entry, index)}
              appearance={entry.pending.outfit}
              highlight={entryStatus(entry) !== 'skip'}
              dimmed={entryStatus(entry) === 'skip'}
            />
          </div>

          {entry.pending.meta?.tags.length ? <div className="flex shrink-0 flex-wrap gap-1.5">
            {entry.pending.meta.tags.map(tag => <span
              key={tag}
              className="rounded-full border border-(--aee-accent-55) px-3 py-0.5 text-[18px] text-(--aee-text)"
            >{tag}</span>)}
          </div> : null}
        </>}
    </div>
  </section>;
}

function PreviewCard({title, subtitle, appearance, highlight = false, dimmed = false}: {
  title: string;
  subtitle: string;
  appearance: readonly ItemBundle[] | null | undefined;
  highlight?: boolean;
  dimmed?: boolean;
}) {
  return <div
    className={cn(
      'flex min-h-0 flex-col overflow-hidden rounded-xl border bg-black/30',
      highlight ? 'border-(--aee-accent)' : 'border-white/10',
      dimmed && 'opacity-45',
    )}
  >
    <div className="shrink-0 border-b border-white/10 px-2 py-1 text-center">
      <div className="text-[20px] text-white">{title}</div>
      <div className="truncate text-[18px] text-zinc-500">{subtitle}</div>
    </div>

    <CharacterPreview appearance={appearance} className="min-h-0 flex-1"/>
  </div>;
}