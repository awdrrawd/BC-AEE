import type {AeeState} from '@/core/types';
import {getAssetBaseXY, getLayerOverride} from '@/core/bc';
import {t} from '@/i18n/i18n';
import {
  closeTransformOverlay,
  moveTransformOverlay,
  resetEditProperty,
  setActiveDrag,
  setEditProperty,
  setScaleLock,
} from '@/controllers/uiController';
import {FloatingPanel} from '@/components/FloatingPanel';
import {Button} from '@/components/ui/Button';
import {SliderRow} from '@/components/overlays/SliderRow';
import {getSelectedLayerLabel} from '@/components/overlays/getSelectedLayerLabel';

export function TransformOverlay({state}: { state: AeeState }) {
  const mode = state.transformOverlay.mode;
  if (!mode || !state.canvasRect || !state.item || state.selectedLayer === null) return null;

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
  const left = state.transformOverlay.left ?? 46;
  const top = state.transformOverlay.top ?? 90;
  const activeDrag = state.activeDrag === mode;
  const title = mode === 'xy'
    ? t('transform-overlay-position-title')
    : mode === 'rot'
      ? t('transform-overlay-rotation-title')
      : mode === 'scale'
        ? t('transform-overlay-scale-title')
        : t('transform-overlay-skew-title');

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

  const resetMode = () => {
    if (mode === 'xy') {
      resetEditProperty('x');
      resetEditProperty('y');
    } else if (mode === 'rot') {
      resetEditProperty('rot');
    } else if (mode === 'scale') {
      resetEditProperty('sx');
      resetEditProperty('sy');
    } else {
      resetEditProperty('skx');
      resetEditProperty('sky');
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
    {mode === 'xy' ? <>
      <SliderRow label="X" value={x} min={Math.min(-500, x - 300)} max={Math.max(2500, x + 300)} step={1}
                 display={String(Math.round(x))} onChange={value => setEditProperty('x', value)}/>
      <SliderRow label="Y" value={y} min={Math.min(-500, y - 300)} max={Math.max(1500, y + 300)} step={1}
                 display={String(Math.round(y))} onChange={value => setEditProperty('y', value)}/>
    </> : null}
    {mode === 'rot' ?
      <SliderRow label="°" value={rotation} min={0} max={359} step={1} display={`${Math.round(rotation)}°`}
                 onChange={value => setEditProperty('rot', value)}/> : null}
    {mode === 'scale' ? <>
      <div className="flex items-center justify-between">
        <span className="text-[11px]"
              style={{color: 'oklch(0.871 0.006 286.286)'}}>{t('transform-overlay-linked-scale-label')}</span>
        <Button className="h-6" selected={state.scaleLock} onClick={() => setScaleLock()}>
          {state.scaleLock ? t('transform-overlay-scale-locked-button') : t('transform-overlay-scale-free-button')}
        </Button>
      </div>
      <SliderRow label="X" value={sx} min={0.05} max={Math.max(3, sx + 1)} step={0.01} display={sx.toFixed(2)}
                 onChange={value => setScale('sx', value)}/>
      <SliderRow label="Y" value={sy} min={0.05} max={Math.max(3, sy + 1)} step={0.01} display={sy.toFixed(2)}
                 onChange={value => setScale('sy', value)}/>
    </> : null}
    {mode === 'skew' ? <>
      <SliderRow label="X°" value={skewX} min={Math.min(-60, skewX - 15)} max={Math.max(60, skewX + 15)} step={0.1}
                 display={`${skewX.toFixed(1)}°`} onChange={value => setEditProperty('skx', value)}/>
      <SliderRow label="Y°" value={skewY} min={Math.min(-60, skewY - 15)} max={Math.max(60, skewY + 15)} step={0.1}
                 display={`${skewY.toFixed(1)}°`} onChange={value => setEditProperty('sky', value)}/>
    </> : null}
    <div className="mt-1 flex items-center gap-1.5 border-t border-zinc-800 pt-2">
      <Button className="h-7 flex-1" selected={activeDrag} onClick={() => setActiveDrag(mode)}>
        {activeDrag ? t('transform-overlay-canvas-drag-active-button') : t('transform-overlay-canvas-drag-button')}
      </Button>
      <Button className="h-7" tone="danger" onClick={resetMode}>
        {t('transform-overlay-reset-button')}
      </Button>
    </div>
  </FloatingPanel>;
}
