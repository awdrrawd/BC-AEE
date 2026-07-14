import {t} from '@/i18n/i18n';
import {THEME_PRESETS, UI_STYLE_LABEL_KEYS, UI_STYLES, type UiTheme} from '@/core/theme';
import {selectThemePreset, setCustomAccent, setUiStyle} from '@/controllers/wardrobeController';
import {ThemePresetCard} from '@/components/wardrobe/dialogs/ThemePresetCard';
import {ColorInput} from '@/components/ui/Fields';
import {Button} from '@/components/ui/Button';

export function AppearanceTab({theme}: { theme: UiTheme }) {
  return <div className="flex flex-col gap-5">
    <section className="flex flex-col gap-3">
      <h3 className="text-[26px] text-white">{t('wardrobe-theme-presets')}</h3>
      <div className="grid grid-cols-5 gap-4">
        {THEME_PRESETS.map(preset => <ThemePresetCard
          key={preset.id}
          preset={preset}
          selected={theme.preset === preset.id}
          onSelect={() => selectThemePreset(preset.id)}
        />)}
      </div>
    </section>

    <section className="flex flex-col gap-3">
      <h3 className="text-[26px] text-white">{t('wardrobe-custom-accent')}</h3>
      <div className="flex items-center gap-4">
        <ColorInput
          className="h-11 w-40"
          value={theme.accent}
          ariaLabel={t('wardrobe-custom-accent')}
          onColorChange={setCustomAccent}
        />
        <span className="text-[22px] uppercase text-white/60">{theme.accent}</span>
      </div>
    </section>

    <section className="flex flex-col gap-3">
      <h3 className="text-[26px] text-white">{t('wardrobe-ui-style')}</h3>
      <div className="flex gap-2.5">
        {UI_STYLES.map(style => <Button density="stage"
                                        key={style}
                                        className="h-11 flex-1"
                                        selected={theme.uiStyle === style}
                                        onClick={() => setUiStyle(style)}
        >{t(UI_STYLE_LABEL_KEYS[style])}</Button>)}
      </div>
    </section>

    <p className="text-[20px] leading-relaxed text-white/45">
      {t('wardrobe-appearance-hint-1')}<br/>
      {t('wardrobe-appearance-hint-2')}
    </p>
  </div>;
}
