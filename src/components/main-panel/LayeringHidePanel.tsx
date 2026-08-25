import {getLayeringHiddenGroups, getLayeringHideGroupLabel, getLayeringHideGroups, resetLayeringHide, setLayeringGroupHidden} from '@/controllers/layeringHideController';
import {t} from '@/i18n/i18n';

export function LayeringHidePanel({item}: {item: Item}) {
  const groups = getLayeringHideGroups(item);
  const hidden = new Set(getLayeringHiddenGroups(item));
  return <div className="divide-y divide-zinc-800">
    <div className="p-3">
      <button type="button" className="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 hover:border-(--aee-accent)"
              onClick={resetLayeringHide}>{t('layering-hide-reset')}</button>
    </div>
    {groups.map(group => <label key={group} className="flex cursor-pointer items-center justify-between gap-3 px-3 py-3 hover:bg-zinc-800/70">
      <span className="min-w-0 truncate text-sm text-zinc-200">{getLayeringHideGroupLabel(item, group)}</span>
      <span className="flex items-center">
        <span className="relative inline-flex h-6 w-11 shrink-0">
          <input type="checkbox" role="switch" className="peer sr-only" checked={hidden.has(group)}
                 onChange={event => setLayeringGroupHidden(group, event.currentTarget.checked)}/>
          <span className="absolute inset-0 rounded-full border border-zinc-600 bg-zinc-700 transition peer-checked:border-(--aee-accent) peer-checked:bg-(--aee-accent-55)"/>
          <span className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-zinc-200 shadow transition-transform peer-checked:translate-x-5 peer-checked:bg-white"/>
        </span>
      </span>
    </label>)}
    <div className="px-3 py-3 text-xs leading-relaxed text-zinc-400">{t('layering-hide-panel-hint')}</div>
  </div>;
}
