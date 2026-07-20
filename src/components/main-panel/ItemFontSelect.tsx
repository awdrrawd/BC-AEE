import {ChevronRight} from 'lucide-react';
import {t} from '@/i18n/i18n';
import {useSetting, settings} from '@/core/settings';
import {DEFAULT_FONT_ID, findCustomFont, findSystemFont} from '@/core/fonts';
import {openFontPanel} from '@/core/fontPanel';

export function ItemFontSelect() {
  const value = useSetting(settings.itemFont) || DEFAULT_FONT_ID;

  // Trigger shows the font name only; sizes/capacities live inside the panel.
  const name = value === DEFAULT_FONT_ID
    ? t('settings-item-font-default')
    : findSystemFont(value)?.name ?? findCustomFont(value)?.name ?? value;

  return <div className="flex items-center justify-between gap-2 border-b border-zinc-800 py-2">
    <span className="shrink-0 text-xs text-zinc-300">{t('settings-item-font-label')}</span>
    <button
      type="button"
      title={t('settings-item-font-open-panel')}
      onClick={openFontPanel}
      className="flex min-h-7 min-w-0 max-w-[62%] flex-1 items-center justify-between gap-1.5 rounded-(--aee-panel-radius) border-2 border-(--aee-accent-55) bg-transparent px-2 text-xs text-(--aee-text) transition-colors hover:border-(--aee-accent) hover:bg-(--aee-accent-16) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--aee-accent-55)"
    >
      <span className="truncate">{name}</span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-70"/>
    </button>
  </div>;
}
