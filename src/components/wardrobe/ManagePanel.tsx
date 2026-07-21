import {Save, Shirt, SquareX} from 'lucide-react';
import {t} from '@/i18n/i18n';
import cn from '@/util/cn';

import {
  exportOutfitToClipboard,
  exportWardrobeToFile,
  exportWornToClipboard,
  importOutfitFromCode,
  readImportFile,
  saveOutfit,
  tryOnOutfit,
} from '@/controllers/outfitsController';
import {importBcxAppearanceWithCategory} from '@/controllers/importExportController';
import {clearSelection} from '@/controllers/wardrobeController';
import {openDialog} from '@/core/dialogs';
import {askConfirm} from '@/core/prompts';
import {showToast} from '@/util/toast';
import {getTargetCharacter, type WardrobeState} from '@/core/wardrobeStore';
import {ImportDialog} from '@/components/wardrobe/dialogs/ImportDialog';
import {OutfitEditForm} from '@/components/wardrobe/OutfitEditForm';
import {OutfitNameField} from '@/components/wardrobe/OutfitNameField';
import {TagRow} from '@/components/wardrobe/TagRow';
import {TransferRow} from '@/components/wardrobe/TransferRow';
import {useStage} from '@/components/wardrobe/stageContext';
import {Button} from '@/components/ui/Button';
import {Panel} from '@/components/ui/Panel';
import {SettingRow} from '@/components/ui/SettingRow';
import {settings} from '@/core/settings';

export function ManagePanel({state}: { state: WardrobeState }) {
  const {portrait} = useStage();
  const hasSelection = state.selection >= 0;
  const editing = hasSelection && state.editing;
  // Fixed width beside the grid in landscape; shares the top half and may scroll in portrait.
  // overflowY is set inline so it beats Panel's base `overflow-hidden` class.
  const widthClass = portrait ? 'min-w-0 flex-1' : 'w-82.5 shrink-0';
  const panelStyle = {animationDelay: '120ms', ...(portrait ? {overflowY: 'auto' as const} : {})};

  const save = async () => {
    if (settings.wardrobeConfirmSave.get() && !(await askConfirm(t('wardrobe-confirm-save')))) return;
    saveOutfit(state.selection, state.name);
  };

  const importFromClipboard = async () => {
    // With a slot selected: import the clipboard code straight into that slot.
    // This overwrites a saved outfit, so it honours the "confirm before saving" guard.
    if (hasSelection) {
      if (settings.wardrobeConfirmSave.get() && !(await askConfirm(t('wardrobe-confirm-import-slot')))) return;
      let code = '';
      try {
        code = (await navigator.clipboard.readText()).trim();
      } catch (error) {
        console.warn('🐈‍⬛ [AEE] Failed to read the clipboard', error);
      }
      if (code) importOutfitFromCode(state.selection, code);
      else showToast(t('wardrobe-toast-import-failed'));
      return;
    }
    // No slot selected: dress the previewed character, showing the BCX-style diff panel.
    void importBcxAppearanceWithCategory(getTargetCharacter());
  };

  const importFromFile = async (file: File) => {
    const outfits = await readImportFile(file);
    if (outfits) openDialog(close => <ImportDialog initial={outfits} onClose={close}/>);
  };

  if (editing) {
    return <Panel soft className={cn('aee-rise-in gap-3 p-4', widthClass)} style={panelStyle}>
      <OutfitEditForm key={state.selection} slot={state.selection}/>
    </Panel>;
  }

  return <Panel
    soft
    className={cn('aee-rise-in gap-3 p-4', widthClass)}
    style={panelStyle}
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
            onClick={() => void save()}
            icon={<Save className="h-5 w-5"/>}
    >{t('wardrobe-save')}</Button>

    <Button density="stage"
            className="h-[50px] shrink-0"
            disabled={!hasSelection}
            onClick={() => tryOnOutfit(state.selection)}
            icon={<Shirt className="h-6 w-6"/>}
    >{t('wardrobe-try-on')}</Button>

    <Button density="stage"
            className="h-[50px] shrink-0"
            disabled={!hasSelection}
            onClick={clearSelection}
            icon={<SquareX className="h-6 w-6"/>}
    >{t('wardrobe-deselect')}</Button>

    <TransferRow
      className="mt-[50px]"
      label={hasSelection ? t('wardrobe-clipboard-save') : t('wardrobe-clipboard-save-worn')}
      onExport={() => (hasSelection ? exportOutfitToClipboard(state.selection) : exportWornToClipboard())}
      onImport={() => void importFromClipboard()}
    />

    <TransferRow
      label={t('wardrobe-file-save')}
      onExport={exportWardrobeToFile}
      onImportFile={file => void importFromFile(file)}
    />
  </Panel>;
}
