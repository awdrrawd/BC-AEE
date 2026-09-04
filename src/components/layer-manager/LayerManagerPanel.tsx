import type {AeeState} from '@/core/types';
import {t} from '@/i18n/i18n';
import {forceUiUpdate} from '@/core/context';
import {
  buildLayerRows,
  requestCloseLayerManagerPanel,
  filterLayerRows,
  type LayerRow,
  resetLayerPriority,
  openLayerRowColor,
  sortLayerRows,
  setLayerManagerSearch,
  setLayerManagerFilterMode,
  setLayerPriority,
  toggleLayerManagerSortDirection,
} from '@/controllers/layerManagerController';
import type {LayerManagerFilterMode} from '@/core/types';
import {Button} from '@/components/ui/Button';
import {Panel} from '@/components/ui/Panel';
import {TextInput} from '@/components/ui/Fields';
import {ArrowDown, ArrowUp} from '@/components/main-panel/icons/Icons';
import {startHoverHighlight, stopHoverHighlight} from '@/controllers/uiController';

const FILTER_MODES: LayerManagerFilterMode[] = ['all', 'custom', 'default'];

// Default spot the panel opens at (before the user ever drags it): upper
// portion of the canvas, off to one side so the character underneath isn't
// immediately covered — the user drags it wherever suits their outfit.
function LayerManagerRow({row, target}: { row: LayerRow; target: Character }) {
  const commit = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    setLayerPriority(target, row, parsed);
    forceUiUpdate();
  };

  return <div
    className="flex items-center gap-3 border-b border-zinc-800/70 px-3 py-2 last:border-b-0 hover:bg-white/[0.03]"
    onMouseEnter={() => startHoverHighlight(row.item, String(row.layerIndex))}
    onMouseLeave={() => stopHoverHighlight(true)}
  >
    <button className="min-w-0 flex-1 text-left" onClick={() => { stopHoverHighlight(true); openLayerRowColor(target, row); }}
            title={t('layer-manager-open-color-tooltip')}>
      <div className="truncate text-sm text-[var(--aee-text-strong)]">
        {row.groupLabel} <span className="text-zinc-500">&gt;</span> {row.itemLabel} <span className="text-zinc-500">&gt;</span> {row.partLabel}
      </div>
      {row.isCustom
        ? <div className="text-[11px] text-zinc-500">{t('layer-manager-row-custom', {default: row.layerDefault})}</div>
        : null}
    </button>
    <TextInput
      type="number"
      min={-99}
      max={99}
      defaultValue={row.priority}
      key={`${row.id}-${row.priority}`}
      className="w-20 text-center"
      onBlur={event => commit(event.currentTarget.value)}
      onKeyDown={event => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
    <Button
      density="compact"
      tone={row.isCustom ? 'danger' : 'ghost'}
      disabled={!row.isCustom}
      onClick={() => {
        resetLayerPriority(target, row);
        forceUiUpdate();
      }}
    >
      {t('layer-manager-reset-button')}
    </Button>
  </div>;
}

export function LayerManagerPanel({state}: { state: AeeState }) {
  const lm = state.layerManager;
  const target = lm.target;
  const canvasRect = state.canvasRect;

  if (!lm.open || !canvasRect || !target) return null;

  // Deliberately NOT memoized on `target` alone: setLayerPriority/reset mutate
  // the same Character object in place (its reference never changes), so a
  // memo keyed on that reference would miss every edit and show stale
  // priorities until the panel was closed and reopened. Rebuilding on every
  // render is cheap for a per-character layer count and always correct.
  const rows = buildLayerRows(target);
  const filtered = sortLayerRows(filterLayerRows(rows, lm.search, lm.filterMode), lm.sortDirection);
  const close = () => {
    stopHoverHighlight(true);
    requestCloseLayerManagerPanel();
  };

  return <div className="fixed z-1000002 pointer-events-none" style={{left: canvasRect.left, top: canvasRect.top, width: canvasRect.width, height: canvasRect.height}}>
    <Panel className={`${lm.closing ? 'aee-panel-slide-right-exit' : 'aee-panel-slide-right-enter'} pointer-events-auto absolute bottom-0 right-0 top-0 flex w-[40%] min-w-[420px] flex-col rounded-none border-y-0 border-r-0`}>
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-zinc-700 bg-zinc-900 px-3">
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-(--aee-accent)">{t('layer-manager-title')}</span>
        <button className="h-[25px] w-[35px] rounded border border-red-800 bg-red-950/60 text-red-200 transition hover:border-red-300 hover:bg-red-900"
                onClick={close}>×</button>
      </div>
    <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-3 py-2">
      <TextInput
        type="text"
        value={lm.search}
        placeholder={t('layer-manager-search-placeholder')}
        onChange={event => setLayerManagerSearch(event.currentTarget.value)}
        className="min-w-0 flex-1"
      />
      <div className="flex shrink-0 gap-1">
        {FILTER_MODES.map(mode => <Button
          key={mode}
          density="compact"
          selected={lm.filterMode === mode}
          onClick={() => setLayerManagerFilterMode(mode)}
        >
          {t(`layer-manager-filter-${mode}`)}
        </Button>)}
        <Button density="compact" onClick={toggleLayerManagerSortDirection}
                title={t(lm.sortDirection === 'asc' ? 'layer-manager-sort-asc' : 'layer-manager-sort-desc')}>
          {lm.sortDirection === 'asc' ? <ArrowUp className="h-4 w-4"/> : <ArrowDown className="h-4 w-4"/>}
        </Button>
      </div>
    </div>

    <div className="aee-scroll min-h-0 flex-1 overflow-y-auto">
      {filtered.length === 0
        ? <div className="p-6 text-center text-sm text-zinc-500">{t('layer-manager-no-results')}</div>
        : filtered.map(row => <LayerManagerRow key={row.id} row={row} target={target}/>)}
    </div>
    <div className="shrink-0 border-t border-zinc-700 bg-zinc-950 px-3 py-2 text-center text-xs text-zinc-400">
      {t('layer-manager-total-count', {filtered: filtered.length, total: rows.length})}
    </div>
    </Panel>
  </div>;
}
