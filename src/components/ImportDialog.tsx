import {useState} from 'react';
import type {AeeState} from '@/core/types';
import {t} from '@/i18n/i18n';
import {applyImportCategories, closeImportDialog} from '@/controllers/importExportController';
import {ImportCategoryOption} from '@/components/import-dialog/ImportCategoryOption';
import {importCategories} from '@/components/import-dialog/importCategories';

export function ImportDialog({state}: { state: AeeState }) {
  const dialog = state.importDialog;
  const [selected, setSelected] = useState(() => new Set(['clothes', 'body']));
  if (!dialog) return null;

  return <div
    className="fixed inset-0 z-[1000003] flex items-center justify-center bg-black/60 p-4 text-zinc-100 backdrop-blur-sm"
    onClick={event => {
      if (event.target === event.currentTarget) closeImportDialog();
    }}>
    <div className="w-full max-w-xs overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl">
      <div
        className="border-b border-zinc-700 bg-zinc-900 px-4 py-3 text-center text-sm font-bold uppercase tracking-wide text-violet-300">
        {t('import-dialog-title')}
      </div>
      <div className="flex flex-col gap-2 p-4">
        {importCategories.map(category => <ImportCategoryOption
          key={category.key}
          category={category}
          checked={selected.has(category.key)}
          onChange={checked => {
            setSelected(prev => {
              const next = new Set(prev);
              if (checked) next.add(category.key);
              else next.delete(category.key);
              return next;
            });
          }}
        />)}
      </div>
      <div className="flex gap-2 border-t border-zinc-800 p-3">
        <button
          className="flex-1 rounded-lg border border-violet-500 bg-violet-600 px-3 py-2 text-sm font-bold text-white hover:bg-violet-500"
          onClick={() => applyImportCategories(dialog.character, dialog.appearance, selected)}>{t('import-dialog-import-button')}</button>
        <button
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-bold text-zinc-400 hover:text-zinc-100"
          onClick={closeImportDialog}>{t('import-dialog-cancel-button')}</button>
      </div>
    </div>
  </div>;
}
