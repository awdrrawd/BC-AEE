import {Save, Shirt} from 'lucide-react';
import {t} from '@/i18n/i18n';

import {
  exportOutfitToClipboard,
  exportWardrobeToFile,
  importOutfitFromCode,
  saveOutfit,
  stageImportFromFile,
  tryOnOutfit,
} from '@/controllers/outfitsController';
import {openDialog} from '@/core/dialogs';
import {askText} from '@/core/prompts';
import type {WardrobeState} from '@/core/wardrobeStore';
import {ImportDialog} from '@/components/wardrobe/dialogs/ImportDialog';
import {OutfitNameField} from '@/components/wardrobe/OutfitNameField';
import {TagRow} from '@/components/wardrobe/TagRow';
import {TransferRow} from '@/components/wardrobe/TransferRow';
import {Button} from '@/components/ui/Button';
import {Panel} from '@/components/ui/Panel';
import {SettingRow} from '@/components/ui/SettingRow';
import {settings} from '@/core/settings';

export function ManagePanel({state}: { state: WardrobeState }) {
  const hasSelection = state.selection >= 0;

  const importFromClipboard = async () => {
    const code = await askText(t('wardrobe-prompt-paste-code'));
    if (code?.trim()) importOutfitFromCode(state.selection, code.trim());
  };

  const importFromFile = async (file: File) => {
    if (await stageImportFromFile(file)) openDialog(close => <ImportDialog onClose={close}/>);
  };

  return <Panel
    className="aee-rise-in w-82.5 shrink-0 gap-3 p-4"
    style={{animationDelay: '120ms'}}
  >
    <h2 className="shrink-0 text-center text-[28px] text-[#f0eee4]">{t('wardrobe-outfit-manage')}</h2>

    <OutfitNameField value={state.name} disabled={!hasSelection}/>
    <TagRow selection={state.selection}/>

    <SettingRow label={t('wardrobe-include-body')} setting={settings.wardrobeIncludeBody}
                density="stage" className="h-auto border-0 bg-transparent px-0"/>
    <SettingRow label={t('wardrobe-include-items')} setting={settings.wardrobeIncludeItems}
                density="stage" className="h-auto border-0 bg-transparent px-0"/>

    <Button density="stage"
            className="h-10 shrink-0 self-end px-6"
            disabled={!hasSelection}
            onClick={() => saveOutfit(state.selection, state.name)}
            icon={<Save className="h-5 w-5"/>}
    >{t('wardrobe-save')}</Button>

    <TransferRow
      label={t('wardrobe-clipboard-save')}
      disabled={!hasSelection}
      onExport={() => exportOutfitToClipboard(state.selection)}
      onImport={() => void importFromClipboard()}
    />

    <TransferRow
      label={t('wardrobe-file-save')}
      onExport={exportWardrobeToFile}
      onImportFile={file => void importFromFile(file)}
    />

    <Button density="stage"
            className="mt-auto h-[50px] shrink-0"
            disabled={!hasSelection}
            onClick={() => tryOnOutfit(state.selection)}
            icon={<Shirt className="h-6 w-6"/>}
    >{t('wardrobe-try-on')}</Button>
  </Panel>;
}
