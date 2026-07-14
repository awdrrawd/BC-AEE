import {Check} from 'lucide-react';
import {t} from '@/i18n/i18n';
import cn from '@/util/cn';
import {UI_STYLE_LABEL_KEYS, type UiThemePreset} from '@/core/theme';

export function ThemePresetCard({
  preset,
  selected,
  onSelect,
}: {
  preset: UiThemePreset;
  selected: boolean;
  onSelect: () => void;
}) {
  return <button
    type="button"
    onClick={onSelect}
    className={cn(
      'relative flex h-24 flex-col items-center justify-center gap-1 rounded-xl transition',
      selected ? 'border-2' : 'border border-white/10 bg-white/4 hover:bg-white/8',
    )}
    style={selected ? {borderColor: preset.accent, backgroundColor: `${preset.accent}2e`} : undefined}
  >
    <span className="absolute inset-x-2 top-2 h-1.5 rounded-full" style={{backgroundColor: preset.accent}}/>
    <span className={cn('text-[22px]', selected ? 'text-white' : 'text-[#f0eee4]')}>{t(preset.name)}</span>
    <span className="text-[18px] text-white/50">{t(UI_STYLE_LABEL_KEYS[preset.uiStyle])}</span>
    {selected
      ? <Check className="absolute bottom-1.5 right-1.5 h-4.5 w-4.5" style={{color: preset.accent}}/>
      : null}
  </button>;
}
