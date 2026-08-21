import {useEffect, useState} from 'react';
import type {AeeState, ImportCategoryKey, ImportChangeType, ImportDiff, ImportDiffDialog} from '@/core/types';
import {t} from '@/i18n/i18n';
import {applyImportPreview, cancelImport, commitImport, groupDisplayName} from '@/controllers/importExportController';
import {importCategories} from '@/components/import-dialog/importCategories';
import {Button} from '@/components/ui/Button';
import {Panel} from '@/components/ui/Panel';
import {CharacterPreview} from '@/components/wardrobe/CharacterPreview';
import {bundleAppearance} from '@/util/appearanceBundle';

const CHANGE_STYLES: Record<ImportChangeType, {row: string; text: string; sign: string}> = {
  add: {row: 'border-emerald-500/70 bg-emerald-500/10', text: 'text-emerald-300', sign: '+'},
  remove: {row: 'border-rose-500/70 bg-rose-500/10', text: 'text-rose-300', sign: '−'},
  modify: {row: 'border-amber-500/70 bg-amber-500/10', text: 'text-amber-300', sign: '~'},
};

export function ImportDialog({state}: {state: AeeState}) {
  if (!state.importDialog || !state.canvasRect) return null;
  return <ImportDiffPicker dialog={state.importDialog} state={state}/>;
}

function ImportDiffPicker({dialog, state}: {dialog: ImportDiffDialog; state: AeeState}) {
  const {diffs} = dialog;
  const [selected, setSelected] = useState<Set<AssetGroupName>>(() => new Set(diffs.map(diff => diff.group)));
  const [category, setCategory] = useState<ImportCategoryKey | 'all'>('all');
  const [applyLock, setApplyLock] = useState(false);

  useEffect(() => {
    const all = new Set(diffs.map(diff => diff.group));
    setSelected(all);
    setCategory('all');
    setApplyLock(false);
    applyImportPreview(dialog, all, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);

  const update = (next: Set<AssetGroupName>, lock = applyLock) => {
    setSelected(next);
    applyImportPreview(dialog, next, lock);
  };
  const visible = category === 'all' ? diffs : diffs.filter(diff => diff.category === category);
  const afterBundle = bundleAppearance(dialog.character.Appearance);
  const scale = state.canvasRect!.width / 2000;
  const toggleVisible = (checked: boolean) => {
    const next = new Set(selected);
    for (const diff of visible) {
      if (checked) next.add(diff.group);
      else next.delete(diff.group);
    }
    update(next);
  };

  const visibleSelected = visible.filter(diff => selected.has(diff.group)).length;
  return <div className="fixed z-1000003 pointer-events-none" style={{left: state.canvasRect!.left, top: state.canvasRect!.top, width: state.canvasRect!.width, height: state.canvasRect!.height}}>
    <Panel className="pointer-events-auto absolute inset-0 overflow-hidden rounded-none" style={{fontSize: Math.max(10, 14 * scale)}}>
      <h1 className="flex h-[54px] shrink-0 items-center justify-center border-b border-zinc-700 bg-zinc-950 text-xl font-bold text-(--aee-accent)">{t('import-dialog-management-title')}</h1>
      <div className="grid h-[54px] shrink-0 grid-cols-[25%_25%_50%] border-b border-zinc-700 bg-zinc-900 text-[26px] font-bold text-white">
        <div className="flex items-center justify-center">{t('wardrobe-import-before')}</div>
        <div className="flex items-center justify-center border-l border-zinc-700">{t('wardrobe-import-after')}</div>
        <div className="flex items-center justify-center border-l border-zinc-700">{t('import-dialog-clothing-management')}</div>
      </div>
      <div className="relative grid min-h-0 flex-1 grid-cols-[25%_25%_50%]">
        <PreviewColumn appearance={dialog.originalBundle} wearer={dialog.character}/>
        <PreviewColumn appearance={afterBundle} wearer={dialog.character} highlight/>
        <span className="pointer-events-none absolute left-[25%] top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-(--aee-accent-55) bg-zinc-950/90 px-2 py-1 text-xl text-(--aee-accent)">➤</span>
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-zinc-700">
        <header className="flex shrink-0 flex-wrap items-center gap-1 border-b border-zinc-700 bg-zinc-900 p-2">
          <Button density="compact" selected={visible.length > 0 && visibleSelected === visible.length}
                  onClick={() => toggleVisible(visibleSelected !== visible.length)}>{t('toolbar-select-all')}</Button>
          <span aria-hidden="true" className="mr-[15px] h-6 w-px bg-zinc-600"/>
          <Button density="compact" selected={category === 'all'} onClick={() => setCategory('all')}>{t('layer-manager-filter-all')}</Button>
          {importCategories.filter(meta => diffs.some(diff => diff.category === meta.key)).map(meta => <Button
            key={meta.key} density="compact" selected={category === meta.key} onClick={() => setCategory(meta.key)}>{t(meta.labelKey)}</Button>)}
          <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-zinc-300">
            <input type="checkbox" checked={applyLock} onChange={event => {setApplyLock(event.target.checked); applyImportPreview(dialog, selected, event.target.checked);}} className="accent-(--aee-accent)"/>
            {t('import-dialog-apply-lock-label')}
          </label>
        </header>
        <div className="aee-scroll min-h-0 flex-1 overflow-y-auto p-2">
          {visible.map(diff => <DiffRow key={diff.group} diff={diff} checked={selected.has(diff.group)} onChange={checked => {
            const next = new Set(selected);
            if (checked) next.add(diff.group);
            else next.delete(diff.group);
            update(next);
          }}/>) }
        </div>
        <div className="shrink-0 border-t border-zinc-700 bg-zinc-950 px-3 py-2 text-center text-xs text-zinc-400">{t('import-dialog-total-count', {selected: selected.size, total: diffs.length})}</div>
        </section>
      </div>
      <footer className="flex h-[54px] shrink-0 items-center justify-center gap-3 border-t border-zinc-700 bg-zinc-950 px-3">
        <Button className="min-w-36" tone="primary" onClick={() => commitImport(dialog, selected, applyLock)}>{t('import-dialog-done-button')}</Button>
        <Button className="min-w-36" onClick={() => cancelImport(dialog)}>{t('import-dialog-cancel-button')}</Button>
      </footer>
    </Panel>
  </div>;
}

function PreviewColumn({appearance, wearer, highlight = false}: {appearance: readonly ItemBundle[]; wearer: Character; highlight?: boolean}) {
  return <section className={`flex min-h-0 min-w-0 flex-col overflow-hidden border-l first:border-l-0 ${highlight ? 'border-(--aee-accent)' : 'border-zinc-700'}`}>
    <CharacterPreview appearance={appearance} wearer={wearer} className="min-h-0 min-w-0 flex-1 overflow-hidden bg-black/20 [&>canvas]:block [&>canvas]:max-h-full [&>canvas]:max-w-full [&>canvas]:object-contain"/>
  </section>;
}

function DiffRow({diff, checked, onChange}: {diff: ImportDiff; checked: boolean; onChange: (checked: boolean) => void}) {
  const style = CHANGE_STYLES[diff.changeType];
  return <label className={`mb-1 flex cursor-pointer items-center gap-2 rounded border-l-2 px-2 py-2 ${style.row}`}>
    <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="accent-(--aee-accent)"/>
    <strong className={`min-w-0 flex-1 truncate text-lg ${style.text}`}>{style.sign} {groupDisplayName(diff.group)}</strong>
  </label>;
}
