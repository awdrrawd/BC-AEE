import {useState} from 'react';
import type {AeeState} from '../core/types';
import {isZh} from '../core/lang';
import {applyImportCategories, closeImportDialog} from '../controllers/importExportController';

export function ImportDialog({state}: {state: AeeState}) {
  const dialog = state.importDialog;
  const [selected, setSelected] = useState(() => new Set(['clothes', 'body']));
  if (!dialog) return null;

  const cats = [
    {key: 'clothes', zh: '衣服', en: 'Clothes', icon: '衣'},
    {key: 'body', zh: '身體', en: 'Body', icon: '身'},
    {key: 'restraints', zh: '拘束', en: 'Restraints', icon: '拘'},
  ];

  return <div
    className="fixed inset-0 z-[1000003] flex items-center justify-center bg-black/60 p-4 text-zinc-100 backdrop-blur-sm"
    onClick={event => {
    if (event.target === event.currentTarget) closeImportDialog();
  }}>
    <div className="w-full max-w-xs overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl">
      <div className="border-b border-zinc-700 bg-zinc-900 px-4 py-3 text-center text-sm font-bold uppercase tracking-wide text-violet-300">
        {isZh() ? '選擇匯入種類' : 'Select Import Categories'}
      </div>
      <div className="flex flex-col gap-2 p-4">
        {cats.map(cat => <label key={cat.key} className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-200 transition hover:border-violet-400 hover:bg-violet-500/10">
          <input className="h-4 w-4 accent-violet-500" type="checkbox" checked={selected.has(cat.key)} onChange={event => {
            setSelected(prev => {
              const next = new Set(prev);
              if (event.target.checked) next.add(cat.key);
              else next.delete(cat.key);
              return next;
            });
          }}/>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-zinc-700 bg-zinc-950 text-xs font-bold text-teal-300">{cat.icon}</span>
          <span className="min-w-0 flex-1 font-medium">{isZh() ? cat.zh : cat.en}</span>
        </label>)}
      </div>
      <div className="flex gap-2 border-t border-zinc-800 p-3">
        <button className="flex-1 rounded-lg border border-violet-500 bg-violet-600 px-3 py-2 text-sm font-bold text-white hover:bg-violet-500" onClick={() => applyImportCategories(dialog.character, dialog.appearance, selected)}>{isZh() ? '匯入' : 'Import'}</button>
        <button className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-bold text-zinc-400 hover:text-zinc-100" onClick={closeImportDialog}>{isZh() ? '取消' : 'Cancel'}</button>
      </div>
    </div>
  </div>;
}
