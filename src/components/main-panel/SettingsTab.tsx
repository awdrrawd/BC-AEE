import type {AeeState} from '@/core/types';
import {t} from '@/i18n/i18n';
import {AboutAee} from '@/components/main-panel/AboutAee';
import {SettingRow} from '@/components/main-panel/SettingRow';

export function SettingsTab({state}: { state: AeeState }) {
  return <>
    <section className="border-b border-zinc-700 px-3 py-2">
      <SettingRow label={t('settings-appearance-view-control')} settingKey="showCharCtrl"
                  value={state.showCharCtrl}/>
      <SettingRow label={t('settings-replace-bc-color-picker')} settingKey="useAeeColorPicker"
                  value={state.useAeeColorPicker}/>
      <SettingRow label={t('settings-hover-layer-highlight')} settingKey="hoverHighlight"
                  value={state.hoverHighlight}/>
      <SettingRow label={t('settings-hover-item-highlight')}
                  settingKey="hoverHighlightChar" value={state.hoverHighlightChar}/>
      <SettingRow label={t('settings-hide-lscg-layers-panel')} settingKey="hideLscgLayers"
                  value={state.hideLscgLayers}/>
      <SettingRow label={t('settings-enable-button-replacement')}
                  settingKey="enableAeeMenu" value={state.enableAeeMenu}/>
    </section>
    <AboutAee/>
  </>;
}
