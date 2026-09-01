import type {MouseEvent as ReactMouseEvent} from 'react';
import type {AeeState} from '@/core/types';
import {getLayerOverride, isGroupLocked} from '@/core/bc';
import {t} from '@/i18n/i18n';
import {setEditProperty} from '@/controllers/uiController';
import {setRotationDragging} from '@/controllers/dragController';
import {getCapturedLayerGeometry} from '@/controllers/appearancePickerController';

const ROT_CX_PCT = 0.5;
const ROT_CY_PCT = 0.89;
const ROT_RADIUS = 60;

export function RotationOverlay({state}: { state: AeeState }) {
  if (!state.rotationOverlayOpen || !state.canvasRect || !state.item || state.selectedLayer === null) return null;
  // Locked body parts (official FixedPosition) must not be rotated on canvas.
  if (isGroupLocked(state.selectedLayer)) return null;
  const layerOverride = getLayerOverride(state.item, state.selectedLayer);
  const rotation = layerOverride.Rotation ?? 0;
  const geometries = state.selectedLayer === 'all'
    ? state.layers.map((_, index) => getCapturedLayerGeometry(index)).filter((geometry): geometry is NonNullable<typeof geometry> => !!geometry)
    : [getCapturedLayerGeometry(Number.parseInt(state.selectedLayer, 10))].filter((geometry): geometry is NonNullable<typeof geometry> => !!geometry);
  const allPoints = geometries.flatMap(geometry => geometry.corners);
  const wholeCenter = allPoints.length ? [
    (Math.min(...allPoints.map(point => point[0])) + Math.max(...allPoints.map(point => point[0]))) / 2,
    (Math.min(...allPoints.map(point => point[1])) + Math.max(...allPoints.map(point => point[1]))) / 2,
  ] : null;
  const actualPivot = state.selectedLayer === 'all' ? wholeCenter : geometries[0]?.pivot;
  const pivotX = actualPivot ? actualPivot[0] * state.canvasRect.width / 2000 : null;
  const pivotY = actualPivot ? actualPivot[1] * state.canvasRect.height / 1000 : null;
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

  const startDrag = (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setRotationDragging(true);
    setEditProperty('rot', calcAngle(event.clientX, event.clientY));
    const onMove = (ev: MouseEvent) => setEditProperty('rot', calcAngle(ev.clientX, ev.clientY));
    const onUp = () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
      setRotationDragging(false);
    };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
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
      {pivotX !== null && pivotY !== null ? <>
        <circle cx={pivotX} cy={pivotY} r={4} fill="var(--aee-accent-55)"/>
        <line x1={pivotX - 8} y1={pivotY} x2={pivotX + 8} y2={pivotY} stroke="var(--aee-accent)" strokeWidth="2.33"/>
        <line x1={pivotX} y1={pivotY - 8} x2={pivotX} y2={pivotY + 8} stroke="var(--aee-accent)" strokeWidth="2.33"/>
      </> : null}
      <circle className="pointer-events-auto cursor-crosshair" cx={cx} cy={cy} r={ROT_RADIUS} fill="rgba(0,0,0,0.01)"
              stroke="transparent" strokeWidth="28" onMouseDown={startDrag}/>
    </svg>
  </div>;
}
