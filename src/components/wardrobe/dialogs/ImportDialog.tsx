import {Check, Clipboard, Folder, LogOut, Save, Upload} from '@/components/wardrobe/icons/Icons';
import {useState} from 'react';
import {t} from '@/i18n/i18n';
import {applyImports, exportWardrobeToFile, readImportCode, readImportFile} from '@/controllers/outfitsController';
import {askText} from '@/core/prompts';
import type {PendingImport} from '@/core/types';
import type {ImportEntry} from '@/components/wardrobe/dialogs/importPlan';
import {countByStatus, planImports, retarget, toggleAll, toggleEntry} from '@/components/wardrobe/dialogs/importPlan';
import {ImportChangeRow} from '@/components/wardrobe/dialogs/ImportChangeRow';
import {ImportPreviewPane} from '@/components/wardrobe/dialogs/ImportPreviewPane';
import {Button} from '@/components/ui/Button';
import {Dialog} from '@/components/ui/Dialog';
import {FileInput} from '@/components/ui/Fields';
import {WardrobeSourceTabs} from '@/components/wardrobe/dialogs/WardrobeSourceTabs';
import {wardrobeSourceById} from '@/core/wardrobeStorage';
import {getWardrobeState} from '@/core/wardrobeStore';
import {settings} from '@/core/settings';
import type {WardrobeSourceId} from '@/core/types';

export function ImportDialog({initial, onClose}: { initial: readonly PendingImport[]; onClose: () => void }) {
  const [sourceId, setSourceId] = useState<WardrobeSourceId>(() => {
    const current = getWardrobeState().source;
    return current === 'sps' && !settings.wardrobeSpsEnabled.get() ? 'online' : current;
  });
  const source = wardrobeSourceById(sourceId);
  const [pendingOutfits, setPendingOutfits] = useState<readonly PendingImport[]>(initial);
  const [entries, setEntries] = useState<ImportEntry[]>(() => planImports(initial, source));
  const [focus, setFocus] = useState(0);

  const load = (outfits: PendingImport[] | null) => {
    if (!outfits?.length) return;
    setPendingOutfits(outfits);
    setEntries(planImports(outfits, source));
    setFocus(0);
  };

  const chooseSource = async (id: WardrobeSourceId) => {
    const next = wardrobeSourceById(id);
    await next.reload();
    setSourceId(id);
    setEntries(planImports(pendingOutfits, next));
    setFocus(0);
  };

  const paste = async () => {
    const code = await askText(t('wardrobe-prompt-paste-code'));
    if (code?.trim()) load(readImportCode(code.trim()));
  };

  const confirm = async () => {
    const count = await applyImports(entries.filter(entry => entry.selected && entry.target >= 0), source);
    if (count > 0) onClose();
  };

  const counts = countByStatus(entries, source);
  const pending = counts.add + counts.replace;
  const focused = entries[focus] ?? null;

  return <Dialog onDismiss={onClose} className="h-240 w-490 p-6">
    <header className="mb-4 flex shrink-0 items-center gap-4">
      <WardrobeSourceTabs source={sourceId} onChange={chooseSource}/>
      <FileInput
        accept="application/json,.json"
        ariaLabel={t('wardrobe-import-load-file')}
        onSelect={file => void readImportFile(file).then(load)}
      >
        <Button density="stage" className="h-15" tabIndex={-1} icon={<Folder className="h-6 w-6"/>}
        >{t('wardrobe-import-load-file')}</Button>
      </FileInput>

      <Button density="stage" className="h-15" onClick={() => void paste()} icon={<Clipboard className="h-6 w-6"/>}
      >{t('wardrobe-import-paste-code')}</Button>

      <h1 className="flex-1 text-center text-[28px] text-[#f0eee4]">{t('wardrobe-import-title')}</h1>

      <Button density="stage" className="h-15" onClick={() => exportWardrobeToFile(source)} icon={<Upload className="h-6 w-6"/>}
      >{t('wardrobe-export-file')}</Button>

      <Button density="stage" className="h-15 w-22.5" onClick={onClose} icon={<LogOut className="h-6 w-6"/>}
              aria-label={t('wardrobe-cancel')}/>
    </header>

    <div className="flex min-h-0 flex-1 gap-5">
      <ImportPreviewPane entry={focused} index={focus}/>

      <section className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex shrink-0 items-center gap-3">
          <h2 className="flex-1 text-[24px] text-white">{t('wardrobe-import-changes', {n: entries.length})}</h2>
          <span className="text-[20px] text-emerald-300">+{counts.add}</span>
          <span className="text-[20px] text-amber-300">~{counts.replace}</span>
          <span className="text-[20px] text-zinc-500">−{counts.skip}</span>
          <Button density="stage"
                  className="h-9"
                  disabled={!entries.length}
                  onClick={() => setEntries(toggleAll(entries))}
                  icon={<Check className="h-4 w-4"/>}
          >{t('wardrobe-import-toggle-all')}</Button>
        </div>

        <div
          className="aee-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto rounded-xl border border-white/20 p-2">
          {entries.length
            ? entries.map((entry, index) => <ImportChangeRow
              key={entry.id}
              entry={entry}
              index={index}
              source={source}
              focused={index === focus}
              onFocus={() => setFocus(index)}
              onToggle={() => setEntries(toggleEntry(entries, entry.id))}
              onRetarget={target => {
                setEntries(retarget(entries, entry.id, target));
                setFocus(index);
              }}
            />)
            : <p className="m-auto px-6 text-center text-[22px] text-zinc-500">{t('wardrobe-import-empty')}</p>}
        </div>
      </section>
    </div>

    <Button density="stage"
            className="mx-auto mt-4 h-12.5 w-145 shrink-0"
            tone="primary"
            disabled={pending === 0}
            onClick={() => void confirm()}
            icon={<Save className="h-5 w-5"/>}
    >{t('wardrobe-import-apply', {n: pending})}</Button>
  </Dialog>;
}
