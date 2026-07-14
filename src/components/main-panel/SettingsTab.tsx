import {t} from '@/i18n/i18n';
import {AboutAee} from '@/components/main-panel/AboutAee';
import {LanguageSelect} from '@/components/main-panel/LanguageSelect';
import {SettingRow} from '@/components/ui/SettingRow';
import {settings} from '@/core/settings';

export function SettingsTab() {
  return <>
    <section className="border-b border-zinc-700 px-3 py-2">
      <LanguageSelect/>
      <SettingRow label={t('settings-appearance-view-control')} setting={settings.showCharCtrl}/>
      <SettingRow label={t('settings-replace-bc-color-picker')} setting={settings.useAeeColorPicker}/>
      <SettingRow label={t('settings-hover-layer-highlight')} setting={settings.hoverHighlight}/>
      <SettingRow label={t('settings-hover-item-highlight')}
                  setting={settings.hoverHighlightChar}/>
      <SettingRow label={t('settings-hover-tryon')}
                  setting={settings.hoverTryOn}/>
      <SettingRow label={t('settings-enable-copy-paste')}
                  setting={settings.enableCopyPaste}/>
      <SettingRow label={t('settings-hide-lscg-layers-panel')} setting={settings.hideLscgLayers}/>
      <SettingRow label={t('settings-enable-button-replacement')}
                  setting={settings.enableAeeMenu}/>
      <SettingRow label={t('settings-paste-import')}
                  setting={settings.pasteImport}/>
      <SettingRow label={t('settings-bc-wheel-scroll')}
                  setting={settings.bcWheelScroll}/>
      <SettingRow label={t('settings-parts-filter')}
                  setting={settings.enablePartsFilter}/>
      <SettingRow label={t('settings-enable-wardrobe')}
                  setting={settings.enableWardrobe}/>
    </section>
    <AboutAee/>
  </>;
}
