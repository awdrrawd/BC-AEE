import type {ReactNode} from 'react';
import type {AeeState} from '../core/types';
import {getAssetBaseXY, getLayerDisplayName, getLayerOverride} from '../core/bc';
import {isZh, t} from '../core/lang';
import {
  closeOpacityOverlay,
  closeTransformOverlay,
  moveOpacityOverlay,
  moveTransformOverlay,
  resetEditProperty,
  setActiveDrag,
  setEditProperty,
  setOpacity,
  setScaleLock,
  stepOpacity,
} from '../controllers/uiController';
import {clampPanelPosition, TOOL_PANEL_WIDTH} from '../core/overlay';
import {FloatingPanel} from './FloatingPanel';

const OP_BASE_CX = 0.5;
const OP_BASE_CY = 0.97;
const OP_OFFSET_X = 300;
const OP_OFFSET_Y = -200;
const ROT_CX_PCT = 0.5;
const ROT_CY_PCT = 0.89;
const ROT_RADIUS = 60;
const sliderRange = 'h-1.5 w-full cursor-pointer appearance-none rounded accent-violet-500';
const panelButtonBase = 'rounded border bg-zinc-900 px-2 text-[11px] font-semibold transition';
const panelButtonNormal = 'border-zinc-700 text-zinc-300 hover:border-violet-400 hover:text-violet-100';
const panelButtonActive = 'border-teal-300 bg-teal-400/10 text-teal-300 hover:border-teal-300 hover:text-teal-300';
const panelButtonDanger = 'border-zinc-700 text-zinc-400 hover:border-red-300 hover:text-red-200';

export function OpacityOverlay({state}: {state: AeeState}) {
  if (!state.opacityOverlay.open || !state.canvasRect || !state.item || state.selectedLayer === null) return null;
  const layerOverride = getLayerOverride(state.item, state.selectedLayer);
  const value = Math.round((layerOverride.Opacity ?? 1) * 100);
  const defaultLeft = state.canvasRect.width * OP_BASE_CX + OP_OFFSET_X - TOOL_PANEL_WIDTH / 2;
  const defaultPos = clampPanelPosition(defaultLeft, state.canvasRect.height * OP_BASE_CY + OP_OFFSET_Y, state.canvasRect);
  const left = state.opacityOverlay.left ?? defaultPos.left;
  const top = state.opacityOverlay.top ?? defaultPos.top;
  const layerLabel = getSelectedLayerLabel(state);

  return <FloatingPanel
    canvasRect={state.canvasRect}
    left={left}
    top={top}
    title={t('opacity')}
    subtitle={layerLabel}
    onClose={closeOpacityOverlay}
    onMove={moveOpacityOverlay}
  >
    <SliderRow label="%" value={value} min={0} max={100} step={1} display={`${value}%`} inputValue={String(value)} onChange={next => setOpacity(state.selectedLayer!, next)} />
    <div className="mt-1 flex items-center gap-1.5 border-t border-zinc-800 pt-2">
      <PanelButton className="flex-1" onClick={() => stepOpacity(state.selectedLayer!, -1)}>-1</PanelButton>
      <PanelButton className="flex-1" onClick={() => stepOpacity(state.selectedLayer!, 1)}>+1</PanelButton>
      <PanelButton tone="danger" onClick={() => resetEditProperty('op')}>
        {isZh() ? '重置' : 'Reset'}
      </PanelButton>
    </div>
  </FloatingPanel>;
}

export function TransformOverlay({state}: {state: AeeState}) {
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
  const title = mode === 'xy' ? t('coord') : mode === 'rot' ? t('rotate') : mode === 'scale' ? t('scale') : t('skew');

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
          <SliderRow label="X" value={x} min={Math.min(-500, x - 300)} max={Math.max(2500, x + 300)} step={1} display={String(Math.round(x))} onChange={value => setEditProperty('x', value)} />
          <SliderRow label="Y" value={y} min={Math.min(-500, y - 300)} max={Math.max(1500, y + 300)} step={1} display={String(Math.round(y))} onChange={value => setEditProperty('y', value)} />
        </> : null}
        {mode === 'rot' ? <SliderRow label="°" value={rotation} min={0} max={359} step={1} display={`${Math.round(rotation)}°`} onChange={value => setEditProperty('rot', value)} /> : null}
        {mode === 'scale' ? <>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-zinc-500">{isZh() ? '等比例' : 'Linked scale'}</span>
            <PanelButton size="sm" tone={state.scaleLock ? 'active' : 'normal'} onClick={() => setScaleLock()}>
              {state.scaleLock ? (isZh() ? '鎖定' : 'Locked') : (isZh() ? '分離' : 'Free')}
            </PanelButton>
          </div>
          <SliderRow label="X" value={sx} min={0.05} max={Math.max(3, sx + 1)} step={0.01} display={sx.toFixed(2)} onChange={value => setScale('sx', value)} />
          <SliderRow label="Y" value={sy} min={0.05} max={Math.max(3, sy + 1)} step={0.01} display={sy.toFixed(2)} onChange={value => setScale('sy', value)} />
        </> : null}
        {mode === 'skew' ? <>
          <SliderRow label="X°" value={skewX} min={Math.min(-60, skewX - 15)} max={Math.max(60, skewX + 15)} step={0.1} display={`${skewX.toFixed(1)}°`} onChange={value => setEditProperty('skx', value)} />
          <SliderRow label="Y°" value={skewY} min={Math.min(-60, skewY - 15)} max={Math.max(60, skewY + 15)} step={0.1} display={`${skewY.toFixed(1)}°`} onChange={value => setEditProperty('sky', value)} />
        </> : null}
        <div className="mt-1 flex items-center gap-1.5 border-t border-zinc-800 pt-2">
          <PanelButton className="flex-1" tone={activeDrag ? 'active' : 'normal'} onClick={() => setActiveDrag(mode)}>
            {activeDrag ? (isZh() ? '畫布拖移中' : 'Canvas drag on') : (isZh() ? '畫布拖移' : 'Canvas drag')}
          </PanelButton>
          <PanelButton tone="danger" onClick={resetMode}>
            {isZh() ? '重置' : 'Reset'}
          </PanelButton>
        </div>
  </FloatingPanel>;
}

function SliderRow({label, value, min, max, step, display, inputValue, onChange}: {label: string; value: number; min: number; max: number; step: number; display: string; inputValue?: string; onChange: (value: number) => void}) {
  const rangeValue = Math.max(min, Math.min(max, value));
  const pct = max === min ? 0 : ((rangeValue - min) / (max - min)) * 100;
  const displayValue = inputValue ?? display.replace(/[°%]/g, '');
  const commitValue = (raw: string) => {
    const next = Number.parseFloat(raw);
    if (!Number.isNaN(next)) onChange(next);
  };

  return <div>
    <div className="mb-1 flex items-center justify-between gap-2">
      <span className="w-7 shrink-0 text-xs font-semibold text-zinc-300">{label}</span>
      <input
        key={displayValue}
        type="text"
        className="h-6 w-16 rounded border border-zinc-800 bg-zinc-900 px-1 text-right font-mono text-xs text-teal-300 outline-none focus:border-teal-300"
        defaultValue={displayValue}
        onBlur={event => commitValue(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            commitValue((event.target as HTMLInputElement).value);
            (event.target as HTMLInputElement).blur();
          } else if (event.key === 'Escape') {
            (event.target as HTMLInputElement).value = displayValue;
            (event.target as HTMLInputElement).blur();
          }
        }}
        onPointerDown={event => event.stopPropagation()}
      />
    </div>
    <input
      type="range"
      className={sliderRange}
      min={min}
      max={max}
      step={step}
      value={rangeValue}
      style={{background: `linear-gradient(to right, rgba(139,92,246,.95) ${pct}%, rgba(255,255,255,.16) ${pct}%)`}}
      onChange={event => onChange(Number(event.target.value))}
      onPointerDown={event => event.stopPropagation()}
    />
  </div>;
}

function PanelButton({children, onClick, tone = 'normal', size = 'md', className = ''}: {children: ReactNode; onClick: () => void; tone?: 'normal' | 'active' | 'danger'; size?: 'sm' | 'md'; className?: string}) {
  const toneClass = tone === 'active' ? panelButtonActive : tone === 'danger' ? panelButtonDanger : panelButtonNormal;
  const sizeClass = size === 'sm' ? 'h-6' : 'h-7';
  return <button className={`${panelButtonBase} ${sizeClass} ${toneClass} ${className}`} onClick={onClick}>{children}</button>;
}

function getSelectedLayerLabel(state: AeeState) {
  if (state.selectedLayer === 'all') return t('allParts');
  const layerIndex = state.selectedLayer === null ? null : parseInt(state.selectedLayer, 10);
  return getLayerDisplayName(layerIndex === null ? null : state.layers[layerIndex], state.selectedLayer ?? 0);
}

export function RotationOverlay({state}: {state: AeeState}) {
  if (!state.rotationOverlayOpen || !state.canvasRect || !state.item || state.selectedLayer === null) return null;
  const layerOverride = getLayerOverride(state.item, state.selectedLayer);
  const rotation = layerOverride.Rotation ?? 0;
  const cx = state.canvasRect.width * ROT_CX_PCT;
  const cy = state.canvasRect.height * ROT_CY_PCT;
  const rad = rotation * Math.PI / 180;
  const hx = cx + ROT_RADIUS * Math.sin(rad);
  const hy = cy - ROT_RADIUS * Math.cos(rad);

  const calcAngle = (clientX: number, clientY: number) => {
    let angle = Math.atan2(clientX - (state.canvasRect!.left + cx), -(clientY - (state.canvasRect!.top + cy))) * 180 / Math.PI;
    if (angle < 0) angle += 360;
    return Math.round(angle);
  };

  const startDrag = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setEditProperty('rot', calcAngle(event.clientX, event.clientY));
    const onMove = (ev: MouseEvent) => setEditProperty('rot', calcAngle(ev.clientX, ev.clientY));
    const onUp = () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
    };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
  };

  return <div className="fixed z-[999997] pointer-events-none" style={{left: state.canvasRect.left, top: state.canvasRect.top, width: state.canvasRect.width, height: state.canvasRect.height}}>
    <svg className="overflow-visible" width={state.canvasRect.width} height={state.canvasRect.height}>
      <circle cx={cx} cy={cy} r={ROT_RADIUS} fill="rgba(0,0,0,0.3)" stroke="rgba(139,92,246,0.25)" strokeWidth="1"/>
      <circle cx={cx} cy={cy} r={ROT_RADIUS} fill="none" stroke="rgba(139,92,246,0.65)" strokeWidth="2"/>
      <line x1={cx} y1={cy} x2={hx} y2={hy} stroke="rgba(139,92,246,0.8)" strokeWidth="1.5" strokeDasharray="5 3"/>
      <circle cx={hx} cy={hy} r={9} fill="#8b5cf6" stroke="#fff" strokeWidth="2"/>
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="#fff" fontFamily="Segoe UI, sans-serif" fontSize="14" fontWeight="700">{Math.round(rotation)}°</text>
      <text x={cx} y={cy + ROT_RADIUS + 18} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontFamily="Segoe UI, sans-serif" fontSize="11">{t('rotHint')}</text>
      <circle cx={cx} cy={cy} r={4} fill="rgba(139,92,246,0.5)"/>
      <circle className="pointer-events-auto cursor-crosshair" cx={cx} cy={cy} r={ROT_RADIUS} fill="rgba(0,0,0,0.01)" stroke="transparent" strokeWidth="28" onMouseDown={startDrag}/>
    </svg>
  </div>;
}
