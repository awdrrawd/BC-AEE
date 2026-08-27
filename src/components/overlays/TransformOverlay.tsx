import type {AeeState} from '@/core/types';
import {getAssetBaseXY, getLayerOverride, isGroupLocked} from '@/core/bc';
import {t} from '@/i18n/i18n';
import {
  closeTransformOverlay,
  moveTransformOverlay,
  resetEditProperty,
  setEditProperty,
  setScaleLock,
} from '@/controllers/uiController';
import {FloatingPanel} from '@/components/FloatingPanel';
import {Button} from '@/components/ui/Button';
import {SliderRow} from '@/components/overlays/SliderRow';
import {getSelectedLayerLabel} from '@/components/overlays/getSelectedLayerLabel';
import {MirrorGroup} from '@/components/main-panel/MirrorGroup';
import {DragCheck} from '@/components/main-panel/DragCheck';

export function TransformOverlay({state}: { state: AeeState }) {
  const mode = state.transformOverlay.mode;
  if (!mode || !state.canvasRect || !state.item || state.selectedLayer === null) return null;
  // Locked body parts (official FixedPosition) must not expose transform tools.
  if (isGroupLocked(state.selectedLayer)) return null;

  const layerOverride = getLayerOverride(state.item, state.selectedLayer);
  const base = getAssetBaseXY(state.item, state.selectedLayer);
  const layerLabel = getSelectedLayerLabel(state);
  const x = layerOverride.DrawingLeft?.[''] ?? base.bx;
  const y = layerOverride.DrawingTop?.[''] ?? base.by;
  const sx = layerOverride.ScaleX ?? 1;
  const sy = layerOverride.ScaleY ?? 1;
  const rotation = layerOverride.Rotation ?? 0;
  const skewX = layerOverride.SkewX ?? 0;
  const skewY = layerOverride.SkewY ?? 0;
  const xLimit = Math.max(1000, Math.ceil(Math.abs(x) / 100) * 100);
  const yLimit = Math.max(1000, Math.ceil(Math.abs(y) / 100) * 100);
  const left = state.transformOverlay.left ?? 46;
  const top = state.transformOverlay.top ?? 90;
  const title = mode === 'xy'
    ? t('transform-overlay-position-title')
    : mode === 'rot'
      ? t('transform-overlay-rotation-title')
      : mode === 'scale'
        ? t('transform-overlay-scale-title')
        : mode === 'skew'
          ? t('transform-overlay-skew-title')
          : `${t('mirror-group-mode-title')} / ${t('mirror-group-copy-title')}`;

  const setScale = (ctrl: 'sx' | 'sy', value: number) => {
    const next = Math.max(0.05, value);
    if (!state.scaleLock) {
      setEditProperty(ctrl, next);
      return;
    }
    const ratio = sx > 0 ? sy / sx : 1;
    if (ctrl === 'sx') {
      setEditProperty('sx', next);
      setEditProperty('sy', next * ratio);
    } else {
      setEditProperty('sy', next);
      setEditProperty('sx', ratio > 0 ? next / ratio : next);
    }
  };

  return <FloatingPanel
    canvasRect={state.canvasRect}
    left={left}
    top={top}
    title={title}
    subtitle={layerLabel}
    onClose={closeTransformOverlay}
    onMove={moveTransformOverlay}
  >
    {mode !== 'mirror' ? <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
      <span className="text-xs font-bold tracking-wide text-zinc-100">{title}</span>
      <DragCheck mode={mode} label={t(`edit-section-${mode === 'xy' ? 'position' : mode === 'rot' ? 'rotation' : mode}-drag-label`)} activeDrag={state.activeDrag}/>
    </div> : null}
    {mode === 'xy' ? <>
      <SliderRow label="X" value={x} min={-xLimit} max={xLimit} step={1}
                 display={String(Math.round(x))} stepDelta={1} onChange={value => setEditProperty('x', value)} onReset={() => resetEditProperty('x')}/>
      <SliderRow label="Y" value={y} min={-yLimit} max={yLimit} step={1}
                 display={String(Math.round(y))} stepDelta={1} onChange={value => setEditProperty('y', value)} onReset={() => resetEditProperty('y')}/>
    </> : null}
    {mode === 'rot' ?
      <SliderRow label="°" value={rotation} min={0} max={359} step={1} display={`${Math.round(rotation)}°`}
                 stepDelta={1} onChange={value => setEditProperty('rot', value)} onReset={() => resetEditProperty('rot')}/> : null}
    {mode === 'scale' ? <>
      <div className="flex items-center justify-between">
        <span className="text-[11px]"
              style={{color: 'oklch(0.871 0.006 286.286)'}}>{t('transform-overlay-linked-scale-label')}</span>
        <Button className="h-6" selected={state.scaleLock} onClick={() => setScaleLock()}>
          {state.scaleLock ? t('transform-overlay-scale-locked-button') : t('transform-overlay-scale-free-button')}
        </Button>
      </div>
      <SliderRow label="X" value={sx} min={0.05} max={Math.max(3, sx + 1)} step={0.01} display={sx.toFixed(2)}
                 stepDelta={0.1} onChange={value => setScale('sx', value)} onReset={() => resetEditProperty('sx')}/>
      <SliderRow label="Y" value={sy} min={0.05} max={Math.max(3, sy + 1)} step={0.01} display={sy.toFixed(2)}
                 stepDelta={0.1} onChange={value => setScale('sy', value)} onReset={() => resetEditProperty('sy')}/>
    </> : null}
    {mode === 'skew' ? <>
      <SliderRow label="X°" value={skewX} min={Math.min(-60, skewX - 15)} max={Math.max(60, skewX + 15)} step={0.1}
                 display={`${skewX.toFixed(1)}°`} stepDelta={1} onChange={value => setEditProperty('skx', value)} onReset={() => resetEditProperty('skx')}/>
      <SliderRow label="Y°" value={skewY} min={Math.min(-60, skewY - 15)} max={Math.max(60, skewY + 15)} step={0.1}
                 display={`${skewY.toFixed(1)}°`} stepDelta={1} onChange={value => setEditProperty('sky', value)} onReset={() => resetEditProperty('sky')}/>
    </> : null}
    {mode === 'mirror' ? <MirrorGroup layerOverride={layerOverride} activeDrag={state.activeDrag}/> : null}
  </FloatingPanel>;
}
