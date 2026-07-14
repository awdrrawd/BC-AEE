import {type PointerEvent as ReactPointerEvent, useEffect, useRef, useState} from 'react';
import type {AeeState, ImportCategoryKey, ImportChangeType, ImportDiff, ImportDiffDialog} from '@/core/types';
import {t} from '@/i18n/i18n';
import {applyImportPreview, cancelImport, commitImport, groupDisplayName} from '@/controllers/importExportController';
import {importCategories} from '@/components/import-dialog/importCategories';
import {Button} from '@/components/ui/Button';
import {Panel} from '@/components/ui/Panel';

const CHANGE_STYLES: Record<ImportChangeType, { row: string; text: string; sign: string }> = {
  add: {row: 'border-emerald-500/70 bg-emerald-500/10', text: 'text-emerald-300', sign: '+'},
  remove: {row: 'border-rose-500/70 bg-rose-500/10', text: 'text-rose-300', sign: '−'},
  modify: {row: 'border-amber-500/70 bg-amber-500/10', text: 'text-amber-300', sign: '~'},
};

function DiffStat({items, selected}: { items: ImportDiff[]; selected: ReadonlySet<AssetGroupName> }) {
  let add = 0, remove = 0, modify = 0;
  for (const diff of items) {
    if (!selected.has(diff.group)) continue;
    if (diff.changeType === 'add') add++;
    else if (diff.changeType === 'remove') remove++;
    else modify++;
  }
  return <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] font-bold tabular-nums">
    {add > 0 && <span className="text-emerald-300">+{add}</span>}
    {remove > 0 && <span className="text-rose-300">−{remove}</span>}
    {modify > 0 && <span className="text-amber-300">~{modify}</span>}
    {add + remove + modify === 0 && <span className="text-zinc-600">0</span>}
  </span>;
}

export function ImportDialog({state}: { state: AeeState }) {
  const dialog = state.importDialog;
  if (!dialog) return null;
  return <ImportDiffPicker dialog={dialog}/>;
}

function ImportDiffPicker({dialog}: { dialog: ImportDiffDialog }) {
  const {diffs} = dialog;
  const [selected, setSelected] = useState<Set<AssetGroupName>>(() => new Set(diffs.map(diff => diff.group)));
  const [expanded, setExpanded] = useState<Set<ImportCategoryKey>>(() => new Set());
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; sx: number; sy: number; left: number; top: number } | null>(null);

  useEffect(() => {
    const all = new Set(diffs.map(diff => diff.group));
    setSelected(all);
    setExpanded(new Set());
    setPos(null);
    applyImportPreview(dialog, all);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);

  function update(next: Set<AssetGroupName>) {
    setSelected(next);
    applyImportPreview(dialog, next);
  }

  function toggleGroup(group: AssetGroupName, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(group);
    else next.delete(group);
    update(next);
  }

  function toggleCategory(category: ImportCategoryKey, checked: boolean) {
    const next = new Set(selected);
    for (const diff of diffs) {
      if (diff.category !== category) continue;
      if (checked) next.add(diff.group);
      else next.delete(diff.group);
    }
    update(next);
  }

  function toggleExpanded(category: ImportCategoryKey) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function onHeaderPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {id: event.pointerId, sx: event.clientX, sy: event.clientY, left: rect.left, top: rect.top};
    setPos({left: rect.left, top: rect.top});
  }

  function onHeaderPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.id !== event.pointerId) return;
    const left = drag.current.left + event.clientX - drag.current.sx;
    const top = drag.current.top + event.clientY - drag.current.sy;
    setPos({left: Math.max(0, left), top: Math.max(0, top)});
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current?.id === event.pointerId) drag.current = null;
  }

  const categories = importCategories
    .map(meta => {
      const groups = diffs.filter(diff => diff.category === meta.key);
      const checkedCount = groups.filter(diff => selected.has(diff.group)).length;
      return {meta, groups, checkedCount, total: groups.length};
    })
    .filter(category => category.total > 0);

  return <Panel
    ref={panelRef}
    onWheel={event => event.stopPropagation()}
    className={`fixed z-1000003 w-[320px]
      ${pos ? '' : 'right-[2%] top-[5%]'}`}
    style={pos ? {left: pos.left, top: pos.top} : undefined}>
    <div
      className="flex flex-none cursor-grab select-none items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-2 active:cursor-grabbing"
      onPointerDown={onHeaderPointerDown}
      onPointerMove={onHeaderPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}>
      <span className="min-w-0 flex-1 truncate text-xs font-bold text-(--aee-accent)">
        {t('import-dialog-title-diff', {count: diffs.length})}
      </span>
      <DiffStat items={diffs} selected={selected}/>
      <span className="shrink-0 text-zinc-600">⠿</span>
    </div>

    <div
      className="aee-scroll overscroll-contain"
      style={{maxHeight: '70vh', overflowY: 'auto'}}>
      <div className="flex flex-col gap-1 p-2">
        {categories.map(({meta, groups, checkedCount, total}) => {
          const isOpen = expanded.has(meta.key);
          return <div key={meta.key} className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-900/60">
            <div
              className="flex cursor-pointer items-center gap-2 px-2 py-1.5 hover:bg-zinc-800/40"
              onClick={() => toggleExpanded(meta.key)}>
            <span className="flex shrink-0" onClick={event => event.stopPropagation()}>
              <TriStateCheckbox
                checked={checkedCount === total}
                indeterminate={checkedCount > 0 && checkedCount < total}
                onChange={checked => toggleCategory(meta.key, checked)}/>
            </span>
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-700 bg-zinc-950 text-[10px] font-bold text-teal-300">{t(meta.iconKey)}</span>
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{t(meta.labelKey)}</span>
              <span className="shrink-0 text-xs text-zinc-500">({checkedCount}/{total})</span>
              <DiffStat items={groups} selected={selected}/>
              <span
                className={`shrink-0 px-1 text-zinc-500 transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
            </div>

            {isOpen && <div className="flex flex-col gap-0.5 border-t border-zinc-800 bg-zinc-950/40 p-1">
              {groups.map(diff => {
                const group = diff.group;
                const style = CHANGE_STYLES[diff.changeType];
                return <label key={group}
                              className={`flex cursor-pointer items-start gap-2 rounded border-l-2 px-2 py-1 ${style.row}`}>
                  <TriStateCheckbox
                    checked={selected.has(group)}
                    indeterminate={false}
                    onChange={checked => toggleGroup(group, checked)}/>
                  <span className="min-w-0 flex-1 text-[11px] leading-tight">
                  <span className={`font-bold ${style.text}`}>{style.sign}</span>
                    {' '}
                    <span className={`font-semibold ${style.text}`}>{groupDisplayName(group)}</span>
                  <br/>
                  <span className={diff.changeType === 'remove' ? style.text : 'text-zinc-500'}>{diff.fromText}</span>
                  <span className={`px-1 ${style.text}`}>→</span>
                  <span
                    className={diff.changeType === 'remove' ? 'text-zinc-500' : `${style.text} font-medium`}>{diff.toText}</span>
                </span>
                </label>;
              })}
            </div>}
          </div>;
        })}
      </div>
    </div>

    <div className="flex flex-none gap-2 border-t border-zinc-800 p-2">
      <Button className="flex-1" tone="primary"
              onClick={() => commitImport(dialog, selected)}>{t('import-dialog-done-button')}</Button>
      <Button className="flex-1" onClick={() => cancelImport(dialog)}>{t('import-dialog-cancel-button')}</Button>
    </div>
  </Panel>;
}

function TriStateCheckbox({checked, indeterminate, onChange}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input
    ref={ref}
    type="checkbox"
    checked={checked}
    onChange={event => onChange(event.target.checked)}
    className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-(--aee-accent)"/>;
}
