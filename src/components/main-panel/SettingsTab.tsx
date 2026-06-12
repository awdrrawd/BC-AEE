import type {AeeState} from '@/core/types';
import {isZh} from '@/core/lang';
import {AboutAee} from '@/components/main-panel/AboutAee';
import {SettingRow} from '@/components/main-panel/SettingRow';

export function SettingsTab({state}: { state: AeeState }) {
  return <>
    <section className="border-b border-zinc-700 px-3 py-2">
      <SettingRow label={isZh() ? '更衣室視圖控制' : 'Appearance View Control'} settingKey="showCharCtrl"
                  value={state.showCharCtrl}/>
      <SettingRow label={isZh() ? '取代 BC 調色盤' : 'Replace BC color picker'} settingKey="useAeeColorPicker"
                  value={state.useAeeColorPicker}/>
      <SettingRow label={isZh() ? '懸停圖層閃爍（AEE）' : 'Hover layer highlight (AEE)'} settingKey="hoverHighlight"
                  value={state.hoverHighlight}/>
      <SettingRow label={isZh() ? '懸停衣服閃爍（角色身上）' : 'Hover item highlight (character)'}
                  settingKey="hoverHighlightChar" value={state.hoverHighlightChar}/>
      <SettingRow label={isZh() ? '隱藏 LSCG 圖層面板' : 'Hide LSCG layers panel'} settingKey="hideLscgLayers"
                  value={state.hideLscgLayers}/>
      <SettingRow label={isZh() ? '啟用按鈕替換（匯出/匯入）' : 'Enable button replacement (Export/Import)'}
                  settingKey="enableAeeMenu" value={state.enableAeeMenu}/>
    </section>
    <AboutAee/>
  </>;
}
