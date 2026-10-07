import {t} from '@/i18n/i18n';
import {AboutAee} from '@/components/main-panel/AboutAee';
import {LanguageSelect} from '@/components/main-panel/LanguageSelect';
import {ItemFontSelect} from '@/components/main-panel/ItemFontSelect';
import {SettingRow} from '@/components/ui/SettingRow';
import {settings} from '@/core/settings';
import {HoverOutlineSelect} from '@/components/main-panel/HoverOutlineSelect';

export function SettingsTab() {
  return <>
    <section className="border-b border-zinc-700 px-3 py-2">
      <LanguageSelect/>
      <ItemFontSelect/>
      <SettingRow label={t('settings-load-others-font-label')} setting={settings.loadOthersFont}
                  tooltip={t('settings-load-others-font-tooltip')}/>
      <SettingRow label={t('settings-toolbar-always-visible')} setting={settings.toolbarAlwaysVisible}
                  tooltip={t('settings-toolbar-always-visible-tooltip')}/>
      <SettingRow label={t('settings-right-click-exit-drag')} setting={settings.rightClickExitDrag}
                  tooltip={t('settings-right-click-exit-drag-tooltip')}/>
      <SettingRow label={t('settings-replace-bc-color-picker')} setting={settings.useAeeColorPicker}
                  tooltip={t('settings-replace-bc-color-picker-tooltip')}/>
      <SettingRow label={t('settings-enable-wardrobe')} setting={settings.enableWardrobe}
                  tooltip={t('settings-enable-wardrobe-tooltip')}/>
      <SettingRow label={t('settings-enable-free-draw')} setting={settings.enableFreeDraw}
                  tooltip={t('settings-enable-free-draw-tooltip')}/>
      <SettingRow label={t('settings-paste-import')} setting={settings.pasteImport}
                  tooltip={t('settings-paste-import-tooltip')}/>
      <SettingRow label={t('settings-enable-copy-paste')} setting={settings.enableCopyPaste}
                  tooltip={t('settings-enable-copy-paste-tooltip')}/>
      <SettingRow label={t('settings-bc-wheel-scroll')} setting={settings.bcWheelScroll}
                  tooltip={t('settings-bc-wheel-scroll-tooltip')}/>
      <SettingRow label={t('settings-hover-item-highlight')} setting={settings.hoverHighlightChar}
                  tooltip={t('settings-hover-item-highlight-tooltip')}/>
      <SettingRow label={t('settings-hover-panel-outline')} setting={settings.hoverOutlinePanel}
                  tooltip={t('settings-hover-panel-outline-tooltip')}/>
      <HoverOutlineSelect/>
      <SettingRow label={t('settings-hover-layer-highlight')} setting={settings.hoverHighlight}
                  tooltip={t('settings-hover-layer-highlight-tooltip')}/>
      <SettingRow label={t('settings-hover-tryon')} setting={settings.hoverTryOn}
                  tooltip={t('settings-hover-tryon-tooltip')}/>
      <SettingRow label={t('settings-hair-character-preview')} setting={settings.hairCharacterPreview}
                  tooltip={t('settings-hair-character-preview-tooltip')}/>
      <SettingRow label={t('settings-hide-unnecessary-appearance-buttons')} setting={settings.hideUnnecessaryAppearanceButtons}
                  tooltip={t('settings-hide-unnecessary-appearance-buttons-tooltip')}/>
      <SettingRow label={t('settings-hide-lscg-layers-panel')} setting={settings.hideLscgLayers}
                  tooltip={t('settings-hide-lscg-layers-panel-tooltip')}/>
      <SettingRow label={t('settings-hide-bcx-import-export')} setting={settings.hideBcxImportExport}
                  tooltip={t('settings-hide-bcx-import-export-tooltip')}/>
      <SettingRow label={t('settings-hide-arousal-ui')} setting={settings.hideArousalUi}
                  tooltip={t('settings-hide-arousal-ui-tooltip')}/>
    </section>
    <AboutAee/>
  </>;
}
