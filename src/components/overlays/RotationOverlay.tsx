import type {PointerEvent as ReactPointerEvent} from 'react';
import type {AeeState} from '@/core/types';
import {getLayerOverride, isGroupLocked} from '@/core/bc';
import {t} from '@/i18n/i18n';
import {setEditProperty} from '@/controllers/uiController';
import {setRotationDragging} from '@/controllers/dragController';
import {getSelectedLayerGeometry} from '@/controllers/layerGeometryController';
import {beginPointerDrag} from '@/controllers/pointerDragController';

const ROT_CX_PCT = 0.5;
const ROT_CY_PCT = 0.89;
const ROT_RADIUS = 60;

export function RotationOverlay({state}: { state: AeeState }) {
  if (!state.rotationOverlayOpen || !state.canvasRect || !state.item || state.selectedLayer === null) return null;
  // Locked body parts (official FixedPosition) must not be rotated on canvas.
  if (isGroupLocked(state.selectedLayer)) return null;
  const layerOverride = getLayerOverride(state.item, state.selectedLayer);
  const rotation = layerOverride.Rotation ?? 0;
  const geometry = getSelectedLayerGeometry(state);
  const pivots = (geometry?.pivots ?? []).map(([x, y]) => [x * state.canvasRect!.width / 2000, y * state.canvasRect!.height / 1000] as const);
  // The circle is the angle dial, not the item's pivot. Keep the dial in its
  // stable control position and mark the real BC texture pivot separately.
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

  const startDrag = (event: ReactPointerEvent<SVGCircleElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setRotationDragging(true);
    setEditProperty('rot', calcAngle(event.clientX, event.clientY));
    beginPointerDrag(event.nativeEvent, ev => setEditProperty('rot', calcAngle(ev.clientX, ev.clientY)), () => setRotationDragging(false));
  };

  return <div className="fixed z-1000002 pointer-events-none" style={{
    left: state.canvasRect.left,
    top: state.canvasRect.top,
    width: state.canvasRect.width,
    height: state.canvasRect.height
  }}>
    <svg className="overflow-visible" width={state.canvasRect.width} height={state.canvasRect.height}>
      <circle cx={cx} cy={cy} r={ROT_RADIUS} fill="rgba(0,0,0,0.3)" stroke="var(--aee-accent-35)" strokeWidth="1"/>
      <circle cx={cx} cy={cy} r={ROT_RADIUS} fill="none" stroke="var(--aee-accent-65)" strokeWidth="2"/>
      <line x1={cx} y1={cy} x2={hx} y2={hy} stroke="var(--aee-accent)" strokeWidth="1.5" strokeDasharray="5 3"/>
      <circle cx={hx} cy={hy} r={9} fill="var(--aee-accent)" stroke="#fff" strokeWidth="2"/>
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="#fff" fontFamily="Segoe UI, sans-serif"
            fontSize="14" fontWeight="700">{Math.round(rotation)}°
      </text>
      <text x={cx} y={cy + ROT_RADIUS + 18} textAnchor="middle" fill="rgba(255,255,255,0.45)"
            fontFamily="Segoe UI, sans-serif" fontSize="11">{t('rotation-overlay-handle-hint')}</text>
      {pivots.map(([pivotX, pivotY], index) => <g key={`${pivotX}:${pivotY}:${index}`}>
        <circle cx={pivotX} cy={pivotY} r={4} fill="var(--aee-accent-55)"/>
        <line x1={pivotX - 8} y1={pivotY} x2={pivotX + 8} y2={pivotY} stroke="var(--aee-accent)" strokeWidth="2.33"/>
        <line x1={pivotX} y1={pivotY - 8} x2={pivotX} y2={pivotY + 8} stroke="var(--aee-accent)" strokeWidth="2.33"/>
      </g>)}
      <circle className="pointer-events-auto cursor-crosshair" cx={cx} cy={cy} r={ROT_RADIUS} fill="rgba(0,0,0,0.01)"
              stroke="transparent" strokeWidth="28" onPointerDown={startDrag}/>
    </svg>
  </div>;
}
