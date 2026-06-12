import type {AeeState, LayerId} from '@/core/types';
import {t} from '@/i18n/i18n';
import {getAssetBaseXY, getLayerColor, getLayerDisplayName, getLayerOverride, isGroupLocked} from '@/core/bc';
import {openLayerColorPicker, setOpacity, setScaleLock, stepOpacity} from '@/controllers/uiController';
import {LinkIcon} from '@/components/icons/LinkIcon';
import {DragCheck} from '@/components/main-panel/DragCheck';
import {MirrorGroup} from '@/components/main-panel/MirrorGroup';
import {PropGroup} from '@/components/main-panel/PropGroup';
import {PropRow} from '@/components/main-panel/PropRow';
import {RangeInput} from '@/components/main-panel/RangeInput';
import {Section} from '@/components/main-panel/Section';
import {StepPair} from '@/components/main-panel/StepPair';

export function EditSection({state, layerId}: { state: AeeState; layerId: LayerId }) {
  const item = state.item;
  const layers = state.layers;
  const layerOverride = getLayerOverride(item, layerId);
  const label = layerId === 'all' ? t('edit-section-all-parts-label') : getLayerDisplayName(layers[parseInt(layerId, 10)], layerId);
  const base = getAssetBaseXY(item, layerId);
  const x = layerOverride.DrawingLeft?.[''] ?? base.bx;
  const y = layerOverride.DrawingTop?.[''] ?? base.by;
  const sx = layerOverride.ScaleX ?? 1;
  const sy = layerOverride.ScaleY ?? 1;
  const rotation = layerOverride.Rotation ?? 0;
  const opacity = Math.round((layerOverride.Opacity ?? 1) * 100);
  const color = getLayerColor(item, layerId);
  const locked = isGroupLocked();

  return <Section>
    <div className="mb-2 flex items-center justify-between gap-2">
      <span
        className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-bold uppercase tracking-wider text-zinc-100">✦ {label}</span>
      <button
        className="relative h-6 w-10 shrink-0 overflow-hidden rounded border border-zinc-700 bg-[repeating-conic-gradient(#222_0%_25%,#111_0%_50%)] bg-size-[5px_5px] hover:border-teal-300"
        onClick={() => openLayerColorPicker(layerId)}>
        <span className="absolute inset-0" style={color ? {background: color} : undefined}/>
      </button>
    </div>
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between text-xs text-zinc-100">
        <span>{t('edit-section-opacity-label')}</span>
        <StepPair display={`${opacity}%`} onStep={delta => stepOpacity(layerId, delta)}/>
      </div>
      <RangeInput min={0} max={100} step={1} value={opacity} onChange={value => setOpacity(layerId, value)}/>
    </div>
    {locked ? <div
      className="rounded border border-zinc-800 bg-zinc-900/70 px-2 py-3 text-center text-xs leading-6 text-zinc-400">
      {t('edit-transform-locked')}<br/>
      <span className="text-[10px]">{t('edit-opacity-layers-available')}</span>
    </div> : <>
      <PropGroup title={t('edit-section-position-group-title')} dragMode="xy" dragLabel={t('edit-section-position-drag-label')} activeDrag={state.activeDrag}>
        <PropRow label="X" value={x} ctrl="x" deltas={[-5, -1, 1, 5]}/>
        <PropRow label="Y" value={y} ctrl="y" deltas={[-5, -1, 1, 5]}/>
      </PropGroup>
      <PropGroup title={t('edit-section-rotation-group-title')} dragMode="rot" dragLabel={t('edit-section-rotation-drag-label')} activeDrag={state.activeDrag}>
        <PropRow label="°" value={rotation} ctrl="rot" deltas={[-5, -1, 1, 5]}/>
      </PropGroup>
      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-xs font-bold tracking-wide text-zinc-100">{t('edit-section-scale-group-title')}</span>
          <button
            className={`flex h-6 w-6 rotate-90 items-center justify-center rounded border transition ${state.scaleLock ? 'border-teal-300 bg-teal-400/10 text-teal-300' : 'border-zinc-700 text-zinc-400 hover:border-teal-300 hover:text-teal-300'}`}
            onClick={() => setScaleLock()}>
            <LinkIcon locked={state.scaleLock}/>
          </button>
          <DragCheck mode="scale" label={t('edit-section-scale-drag-label')} activeDrag={state.activeDrag}/>
        </div>
        <PropRow label="X" value={sx.toFixed(2)} ctrl="sx" deltas={[-0.3, -0.1, 0.1, 0.3]}/>
        <PropRow label="Y" value={sy.toFixed(2)} ctrl="sy" deltas={[-0.3, -0.1, 0.1, 0.3]}/>
      </div>
      <PropGroup title={t('edit-section-skew-group-title')} dragMode="skew" dragLabel={t('edit-section-skew-drag-label')} activeDrag={state.activeDrag}>
        <PropRow label="X°" value={(layerOverride.SkewX ?? 0).toFixed(1)} ctrl="skx" deltas={[-5, -1, 1, 5]}/>
        <PropRow label="Y°" value={(layerOverride.SkewY ?? 0).toFixed(1)} ctrl="sky" deltas={[-5, -1, 1, 5]}/>
      </PropGroup>
      <MirrorGroup layerOverride={layerOverride}/>
    </>}
  </Section>;
}
