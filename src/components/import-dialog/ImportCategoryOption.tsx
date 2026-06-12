import {isZh} from '../../core/lang';
import {Switch} from '../Switch';

export function ImportCategoryOption({category, checked, onChange}: {
  category: { key: string; zh: string; en: string; icon: string };
  checked: boolean;
  onChange: (checked: boolean) => void
}) {
  return <Switch checked={checked} onChange={onChange} ariaLabel={isZh() ? category.zh : category.en}
                 className="w-full gap-3 rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-200 transition hover:border-violet-400 hover:bg-violet-500/10">
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-zinc-700 bg-zinc-950 text-xs font-bold text-teal-300">{category.icon}</span>
    <span className="min-w-0 flex-1 font-medium">{isZh() ? category.zh : category.en}</span>
  </Switch>;
}
