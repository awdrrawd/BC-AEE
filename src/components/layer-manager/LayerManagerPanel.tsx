import type {AeeState} from '@/core/types';
import {t} from '@/i18n/i18n';
import {forceUiUpdate} from '@/core/context';
import {
  buildLayerRows,
  closeLayerManagerPanel,
  filterLayerRows,
  LAYER_MANAGER_PANEL_WIDTH,
  LAYER_MANAGER_PANEL_MIN_HEIGHT,
  type LayerRow,
  moveLayerManagerPanel,
  resetLayerPriority,
  openLayerRowColor,
  sortLayerRows,
  setLayerManagerSearch,
  setLayerManagerFilterMode,
  setLayerPriority,
  toggleLayerManagerSortDirection,
} from '@/controllers/layerManagerController';
import type {LayerManagerFilterMode} from '@/core/types';
import {clampPanelPosition} from '@/core/overlay';
import {FloatingPanel} from '@/components/FloatingPanel';
import {Button} from '@/components/ui/Button';
import {TextInput} from '@/components/ui/Fields';
import {ArrowDown, ArrowUp} from 'lucide-react';
import {startHoverHighlight, stopHoverHighlight} from '@/controllers/uiController';

const FILTER_MODES: LayerManagerFilterMode[] = ['all', 'custom', 'default'];

// Default spot the panel opens at (before the user ever drags it): upper
// portion of the canvas, off to one side so the character underneath isn't
// immediately covered — the user drags it wherever suits their outfit.
const DEFAULT_LEFT_FRAC = 0.06;
const DEFAULT_TOP_FRAC = 0.06;

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

  const defaultPos = clampPanelPosition(
    canvasRect.width * DEFAULT_LEFT_FRAC,
    canvasRect.height * DEFAULT_TOP_FRAC,
    canvasRect,
    LAYER_MANAGER_PANEL_WIDTH,
    LAYER_MANAGER_PANEL_MIN_HEIGHT,
  );
  const left = lm.left ?? defaultPos.left;
  const top = lm.top ?? defaultPos.top;

  return <FloatingPanel
    canvasRect={canvasRect}
    left={left}
    top={top}
    width={LAYER_MANAGER_PANEL_WIDTH}
    title={t('layer-manager-title')}
    subtitle={`${filtered.length} / ${rows.length}`}
    onClose={() => { stopHoverHighlight(true); closeLayerManagerPanel(); }}
    onMove={moveLayerManagerPanel}
    className="max-h-[80%]"
    bodyClassName="flex min-h-0 flex-1 flex-col gap-0 p-0"
  >
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
  </FloatingPanel>;
}
