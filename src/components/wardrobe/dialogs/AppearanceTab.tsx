import {useEffect, useState} from 'react';
import {t} from '@/i18n/i18n';
import {THEME_PRESETS, UI_STYLE_LABEL_KEYS, UI_STYLES, type UiTheme} from '@/core/theme';
import {
  clearCustomBase,
  resetOpacity,
  selectThemePreset,
  setBaseOpacity,
  setCardOpacity,
  setCustomAccent,
  setCustomBase,
  setUiStyle,
} from '@/controllers/wardrobeController';
import {ThemePresetCard} from '@/components/wardrobe/dialogs/ThemePresetCard';
import {ColorInput, TextInput} from '@/components/ui/Fields';
import {Button} from '@/components/ui/Button';
import {RangeInput} from '@/components/main-panel/RangeInput';

const HEX_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const EMPTY_SWATCH = '#181820';

function ColorField({value, fallback, ariaLabel, placeholder, onChange, onClear}: {
  value: string;
  fallback: string;
  ariaLabel: string;
  placeholder: string;
  onChange: (hex: string) => void;
  onClear?: () => void;
}) {
  const [draft, setDraft] = useState(value);

  // Keep the text field in sync when the value changes elsewhere (preset selection, color wheel, reset).
  useEffect(() => setDraft(value), [value]);

  const commit = (raw: string) => {
    const next = raw.trim();
    if (!next) {
      onClear?.();
      return;
    }
    const hex = next.startsWith('#') ? next : `#${next}`;
    if (HEX_PATTERN.test(hex)) onChange(hex.toLowerCase());
  };

  return <div className="flex items-center gap-4">
    <ColorInput
      className="h-11 w-40"
      value={HEX_PATTERN.test(value) ? value : fallback}
      ariaLabel={ariaLabel}
      onColorChange={onChange}
    />
    <TextInput
      density="stage"
      className="w-44 font-mono uppercase"
      value={draft}
      aria-label={ariaLabel}
      placeholder={placeholder}
      spellCheck={false}
      maxLength={7}
      onChange={event => setDraft(event.currentTarget.value)}
      onBlur={event => commit(event.currentTarget.value)}
      onKeyDown={event => {
        if (event.key === 'Enter') commit(event.currentTarget.value);
      }}
    />
    {onClear ? <Button density="stage" className="h-11 px-4" onClick={onClear}>
      {t('wardrobe-custom-base-reset')}
    </Button> : null}
  </div>;
}

function OpacityRow({label, value, onChange}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return <div className="flex items-center gap-4">
    <span className="w-28 shrink-0 text-[22px] text-[#f0eee4]">{label}</span>
    <RangeInput
      className="h-2 flex-1 cursor-pointer appearance-none rounded bg-white/15 accent-(--aee-accent)"
      min={0}
      max={1}
      step={0.01}
      value={value}
      onChange={onChange}
    />
    <span className="w-16 shrink-0 text-right font-mono text-[20px] text-(--aee-accent)">
      {Math.round(value * 100)}%
    </span>
  </div>;
}

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
      <ColorField
        value={theme.accent}
        fallback="#7648fe"
        ariaLabel={t('wardrobe-custom-accent-hex')}
        placeholder="#7648FE"
        onChange={setCustomAccent}
      />
    </section>

    <section className="flex flex-col gap-3">
      <h3 className="text-[26px] text-white">{t('wardrobe-custom-base')}</h3>
      <ColorField
        value={theme.base}
        fallback={EMPTY_SWATCH}
        ariaLabel={t('wardrobe-custom-base-hex')}
        placeholder={t('wardrobe-custom-base-default')}
        onChange={setCustomBase}
        onClear={clearCustomBase}
      />
    </section>

    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[26px] text-white">{t('wardrobe-opacity')}</h3>
        <Button density="stage" className="h-11 px-4" onClick={resetOpacity}>
          {t('wardrobe-custom-base-reset')}
        </Button>
      </div>
      <OpacityRow label={t('wardrobe-opacity-card')} value={theme.cardOpacity} onChange={setCardOpacity}/>
      <OpacityRow label={t('wardrobe-opacity-base')} value={theme.baseOpacity} onChange={setBaseOpacity}/>
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
