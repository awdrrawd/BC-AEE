import {useRef} from 'react';
import type {AeeState} from '../core/types';
import {getLayerOverride} from '../core/bc';
import {t} from '../core/lang';
import {closeOpacityOverlay, moveOpacityOverlay, setEditProperty, setOpacity, stepOpacity} from '../controllers/uiController';

const OP_BASE_CX = 0.5;
const OP_BASE_CY = 0.97;
const OP_OFFSET_X = 300;
const OP_OFFSET_Y = -200;
const ROT_CX_PCT = 0.5;
const ROT_CY_PCT = 0.89;
const ROT_RADIUS = 60;

export function OpacityOverlay({state}: {state: AeeState}) {
  const drag = useRef<{sx: number; sy: number; left: number; top: number} | null>(null);
  if (!state.opacityOverlay.open || !state.canvasRect || !state.item || state.selectedLayer === null) return null;
  const layerOverride = getLayerOverride(state.item, state.selectedLayer);
  const value = Math.round((layerOverride.Opacity ?? 1) * 100);
  const left = state.opacityOverlay.left ?? (state.canvasRect.width * OP_BASE_CX + OP_OFFSET_X);
  const top = state.opacityOverlay.top ?? (state.canvasRect.height * OP_BASE_CY + OP_OFFSET_Y);

  return <div className="fixed z-999996 pointer-events-none" style={{left: state.canvasRect.left, top: state.canvasRect.top, width: state.canvasRect.width, height: state.canvasRect.height}}>
    <div className="pointer-events-auto absolute flex min-w-52 -translate-x-1/2 flex-col items-center gap-1 rounded-xl border border-violet-400/40 bg-[#100b28]/90 px-3.5 pb-2.5 pt-1.5 text-zinc-100 shadow-2xl backdrop-blur" style={{left, top}}>
      <button className="absolute right-2 top-1 text-sm text-white/30 hover:text-white/70" onClick={closeOpacityOverlay}>x</button>
      <div
        className="flex h-4 w-full cursor-grab select-none items-center justify-center text-[11px] tracking-[3px] text-white/25 active:cursor-grabbing"
        onPointerDown={event => {
          event.preventDefault();
          drag.current = {sx: event.clientX, sy: event.clientY, left, top};
        }}
        onPointerMove={event => {
          if (!drag.current) return;
          moveOpacityOverlay(drag.current.left + event.clientX - drag.current.sx, drag.current.top + event.clientY - drag.current.sy);
        }}
        onPointerUp={() => { drag.current = null; }}
      >. . .</div>
      <div className="text-[11px] font-semibold tracking-wide text-white/55">{t('opacity')}</div>
      <div className="flex items-center gap-1.5">
        <button className="flex h-6 w-6 items-center justify-center rounded border border-violet-400/40 bg-violet-500/15 text-sm hover:bg-violet-500/35" onClick={() => stepOpacity(state.selectedLayer!, -1)}>-</button>
        <input
          type="range"
          className="h-1.5 w-36 cursor-pointer appearance-none rounded accent-violet-500"
          min={0}
          max={100}
          step={1}
          value={value}
          style={{background: `linear-gradient(to right, rgba(139,92,246,.9) ${value}%, rgba(255,255,255,.15) ${value}%)`}}
          onChange={event => setOpacity(state.selectedLayer!, Number(event.target.value))}
        />
        <button className="flex h-6 w-6 items-center justify-center rounded border border-violet-400/40 bg-violet-500/15 text-sm hover:bg-violet-500/35" onClick={() => stepOpacity(state.selectedLayer!, 1)}>+</button>
      </div>
      <div className="min-w-10 text-center text-sm font-bold">{value}%</div>
    </div>
  </div>;
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
