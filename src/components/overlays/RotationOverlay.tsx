import type {MouseEvent as ReactMouseEvent} from 'react';
import type {AeeState} from '@/core/types';
import {getLayerOverride} from '@/core/bc';
import {t} from '@/i18n/i18n';
import {setEditProperty} from '@/controllers/uiController';
import {ROT_CX_PCT, ROT_CY_PCT, ROT_RADIUS} from '@/components/overlays/styles';

export function RotationOverlay({state}: { state: AeeState }) {
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

  const startDrag = (event: ReactMouseEvent) => {
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

  return <div className="fixed z-999997 pointer-events-none" style={{
    left: state.canvasRect.left,
    top: state.canvasRect.top,
    width: state.canvasRect.width,
    height: state.canvasRect.height
  }}>
    <svg className="overflow-visible" width={state.canvasRect.width} height={state.canvasRect.height}>
      <circle cx={cx} cy={cy} r={ROT_RADIUS} fill="rgba(0,0,0,0.3)" stroke="rgba(139,92,246,0.25)" strokeWidth="1"/>
      <circle cx={cx} cy={cy} r={ROT_RADIUS} fill="none" stroke="rgba(139,92,246,0.65)" strokeWidth="2"/>
      <line x1={cx} y1={cy} x2={hx} y2={hy} stroke="rgba(139,92,246,0.8)" strokeWidth="1.5" strokeDasharray="5 3"/>
      <circle cx={hx} cy={hy} r={9} fill="#8b5cf6" stroke="#fff" strokeWidth="2"/>
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="#fff" fontFamily="Segoe UI, sans-serif"
            fontSize="14" fontWeight="700">{Math.round(rotation)}°
      </text>
      <text x={cx} y={cy + ROT_RADIUS + 18} textAnchor="middle" fill="rgba(255,255,255,0.45)"
            fontFamily="Segoe UI, sans-serif" fontSize="11">{t('rotation-overlay-handle-hint')}</text>
      <circle cx={cx} cy={cy} r={4} fill="rgba(139,92,246,0.5)"/>
      <circle className="pointer-events-auto cursor-crosshair" cx={cx} cy={cy} r={ROT_RADIUS} fill="rgba(0,0,0,0.01)"
              stroke="transparent" strokeWidth="28" onMouseDown={startDrag}/>
    </svg>
  </div>;
}
