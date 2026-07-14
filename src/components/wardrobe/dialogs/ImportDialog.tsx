import {Check, Clipboard, Folder, LogOut, Save, Upload} from 'lucide-react';
import {useMemo} from 'react';
import {t} from '@/i18n/i18n';
import {applyPendingImports, exportWardrobeToFile, stageImport, stageImportFromFile} from '@/controllers/outfitsController';
import {closeDialog, toggleAllImportSelection, toggleImportSelection} from '@/controllers/wardrobeController';
import {askText} from '@/core/prompts';
import type {WardrobeState} from '@/core/wardrobeStore';
import {ImportColumn} from '@/components/wardrobe/dialogs/ImportColumn';
import {ImportPendingRow} from '@/components/wardrobe/dialogs/ImportPendingRow';
import {ImportSlotRow} from '@/components/wardrobe/dialogs/ImportSlotRow';
import {Button} from '@/components/ui/Button';
import {Dialog} from '@/components/ui/Dialog';
import {FileInput} from '@/components/ui/Fields';

export function ImportDialog({state}: { state: WardrobeState }) {
  const slots = useMemo(
    () => Array.from({length: WardrobeSize}, (_, index) => index),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.dataVersion],
  );
  const targets = useMemo(() => new Set(state.importTargets.values()), [state.importTargets]);

  const paste = async () => {
    const code = await askText(t('wardrobe-prompt-paste-code'));
    if (code?.trim()) stageImport(code.trim());
  };

  const confirm = () => {
    applyPendingImports();
    closeDialog();
  };

  return <Dialog onDismiss={closeDialog} className="h-240 w-490 p-6">
    <header className="mb-4 flex shrink-0 items-center justify-between">
      <Button density="stage"
              className="h-15"
              onClick={exportWardrobeToFile}
              icon={<Upload className="h-6 w-6"/>}
      >{t('wardrobe-export-file')}</Button>
      <h1 className="text-[28px] text-[#f0eee4]">{t('wardrobe-import-title')}</h1>
      <Button density="stage"
              className="h-15 w-22.5"
              onClick={closeDialog}
              icon={<LogOut className="h-6 w-6"/>}
              aria-label={t('wardrobe-cancel')}
      />
    </header>

    <div className="flex min-h-0 flex-1 gap-5">
      <ImportColumn title={`${t('wardrobe-import-current')} (${WardrobeSize}${t('wardrobe-slots-unit')})`}>
        {slots.map(index => <ImportSlotRow key={index} index={index} isTarget={targets.has(index)}/>)}
      </ImportColumn>

      <ImportColumn title={`${t('wardrobe-import-pending')} (${state.importBuffer.length})`}>
        <div className="flex shrink-0 gap-2">
          <FileInput className="flex-1"
                     accept="application/json,.json"
                     ariaLabel={t('wardrobe-import-load-file')}
                     onSelect={file => void stageImportFromFile(file)}
          >
            <Button density="stage"
                    className="h-[50px] w-full"
                    tabIndex={-1}
                    icon={<Folder className="h-5 w-5"/>}
            >{t('wardrobe-import-load-file')}</Button>
          </FileInput>

          <Button density="stage"
                  className="h-12.5 flex-1"
                  onClick={() => void paste()}
                  icon={<Clipboard className="h-5 w-5"/>}
          >{t('wardrobe-import-paste-code')}</Button>
        </div>

        {state.importBuffer.length > 0 ? <Button density="stage"
                                                 className="h-9 shrink-0"
                                                 onClick={toggleAllImportSelection}
                                                 icon={<Check className="h-4 w-4"/>}
        >{t('wardrobe-import-toggle-all')}</Button> : null}

        {state.importBuffer.map((pending, index) => <ImportPendingRow
          key={index}
          index={index}
          name={pending.name}
          target={state.importTargets.get(index) ?? -1}
          disabled={(state.importTargets.get(index) ?? -1) < 0}
          selected={state.importSelected.has(index)}
          onToggle={() => toggleImportSelection(index)}
        />)}
      </ImportColumn>

      <ImportColumn title={t('wardrobe-import-preview')}>
        <p className="mt-4 text-center text-[22px] text-zinc-500">{t('wardrobe-import-preview-hint')}</p>
      </ImportColumn>
    </div>

    <Button density="stage"
            className="mx-auto mt-4 h-12.5 w-145 shrink-0"
            disabled={state.importSelected.size === 0}
            onClick={confirm}
            icon={<Save className="h-5 w-5"/>}
    >{t('wardrobe-import-selected', {n: state.importSelected.size})}</Button>
  </Dialog>;
}
