import {t} from '@/i18n/i18n';
import {Switch} from '@/components/Switch';

export function ImportCategoryOption({category, checked, onChange}: {
  category: { key: string; labelKey: string; iconKey: string };
  checked: boolean;
  onChange: (checked: boolean) => void
}) {
  const label = t(category.labelKey);
  const icon = t(category.iconKey);
  return <Switch checked={checked} onChange={onChange} ariaLabel={label}
                 className="w-full gap-3 rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-200 transition hover:border-violet-400 hover:bg-violet-500/10">
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-zinc-700 bg-zinc-950 text-xs font-bold text-teal-300">{icon}</span>
    <span className="min-w-0 flex-1 font-medium">{label}</span>
  </Switch>;
}
