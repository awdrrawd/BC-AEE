import type {MouseEvent as ReactMouseEvent} from 'react';
import type {AeeState} from '@/core/types';
import {type CapturedLayerGeometry, getCapturedLayerGeometry, getCapturedTranslationFactor} from '@/controllers/appearancePickerController';
import {getAssetBaseXY, getLayerOverride, isGroupLocked} from '@/core/bc';
import {setEditProperty} from '@/controllers/uiController';
import {t} from '@/i18n/i18n';

type Point = [number, number];
type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: Array<[Handle, number, number, string]> = [
  ['nw', -1, -1, 'nwse-resize'], ['n', 0, -1, 'ns-resize'], ['ne', 1, -1, 'nesw-resize'],
  ['e', 1, 0, 'ew-resize'], ['se', 1, 1, 'nwse-resize'], ['s', 0, 1, 'ns-resize'],
  ['sw', -1, 1, 'nesw-resize'], ['w', -1, 0, 'ew-resize'],
];

function selectedGeometry(state: AeeState): CapturedLayerGeometry | null {
  if (state.selectedLayer !== 'all') return getCapturedLayerGeometry(Number.parseInt(state.selectedLayer ?? '', 10));
  const points = state.layers.flatMap((_, index) => getCapturedLayerGeometry(index)?.corners ?? []);
  if (!points.length) return null;
  const left = Math.min(...points.map(p => p[0])), top = Math.min(...points.map(p => p[1]));
  const right = Math.max(...points.map(p => p[0])), bottom = Math.max(...points.map(p => p[1]));
  return {corners: [[left, top], [right, top], [right, bottom], [left, bottom]], center: [(left + right) / 2, (top + bottom) / 2], pivot: [(left + right) / 2, (top + bottom) / 2], width: right - left, height: bottom - top};
}

function handlePoint(g: CapturedLayerGeometry, hx: number, hy: number): Point {
  const [nw, ne, , sw] = g.corners;
  const ax: Point = [(ne[0] - nw[0]) / 2, (ne[1] - nw[1]) / 2];
  const ay: Point = [(sw[0] - nw[0]) / 2, (sw[1] - nw[1]) / 2];
  return [g.center[0] + ax[0] * hx + ay[0] * hy, g.center[1] + ax[1] * hx + ay[1] * hy];
}

export function FreeTransformGizmo({state}: {state: AeeState}) {
  if (state.editTool !== 'gizmo' || !state.canvasRect || !state.item || state.selectedLayer === null || isGroupLocked(state.selectedLayer)) return null;
  const geometry = selectedGeometry(state);
  if (!geometry) return null;
  const kx = state.canvasRect.width / 2000, ky = state.canvasRect.height / 1000;
  const css = ([x, y]: Point): Point => [x * kx, y * ky];
  const corners = geometry.corners.map(css), center = css(geometry.center), pivot = css(geometry.pivot);
  const topMid: Point = [(corners[0][0] + corners[1][0]) / 2, (corners[0][1] + corners[1][1]) / 2];
  const outward: Point = [topMid[0] - center[0], topMid[1] - center[1]];
  const length = Math.hypot(...outward) || 1;
  const rotateAt: Point = [topMid[0] + outward[0] / length * 30, topMid[1] + outward[1] / length * 30];
  const override = getLayerOverride(state.item, state.selectedLayer), base = getAssetBaseXY(state.item, state.selectedLayer);
  const initial = {x: override.DrawingLeft?.[''] ?? base.bx, y: override.DrawingTop?.[''] ?? base.by, sx: override.ScaleX ?? 1, sy: override.ScaleY ?? 1, rot: override.Rotation ?? 0};

  const listen = (move: (ev: MouseEvent) => void) => {
    const up = () => { document.removeEventListener('mousemove', move, true); document.removeEventListener('mouseup', up, true); };
    document.addEventListener('mousemove', move, true); document.addEventListener('mouseup', up, true);
  };
  const dragMove = (event: ReactMouseEvent) => {
    event.preventDefault(); event.stopPropagation();
    const startX = event.clientX, startY = event.clientY, factor = getCapturedTranslationFactor();
    listen(ev => { setEditProperty('x', initial.x + (ev.clientX - startX) / kx / factor); setEditProperty('y', initial.y + (ev.clientY - startY) / ky / factor); });
  };
  const dragScale = (hx: number, hy: number) => (event: ReactMouseEvent) => {
    event.preventDefault(); event.stopPropagation();
    const startX = event.clientX, startY = event.clientY;
    const angle = state.selectedLayer === 'all' ? 0 : initial.rot * Math.PI / 180;
    listen(ev => {
      const dx = (ev.clientX - startX) / kx, dy = (ev.clientY - startY) / ky;
      const localX = dx * Math.cos(angle) + dy * Math.sin(angle), localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
      if (hx) setEditProperty('sx', Math.max(.01, initial.sx * (1 + hx * localX * 2 / Math.max(geometry.width, 24))));
      if (hy) setEditProperty('sy', Math.max(.01, initial.sy * (1 + hy * localY * 2 / Math.max(geometry.height, 24))));
    });
  };
  const dragRotate = (event: ReactMouseEvent) => {
    event.preventDefault(); event.stopPropagation();
    const px = state.canvasRect!.left + pivot[0], py = state.canvasRect!.top + pivot[1];
    const start = Math.atan2(event.clientY - py, event.clientX - px);
    listen(ev => setEditProperty('rot', initial.rot + (Math.atan2(ev.clientY - py, ev.clientX - px) - start) * 180 / Math.PI));
  };

  return <div className="fixed z-1000003 pointer-events-none" style={{left: state.canvasRect.left, top: state.canvasRect.top, width: state.canvasRect.width, height: state.canvasRect.height}}>
    <svg className="h-full w-full overflow-visible">
      <polygon points={corners.map(p => p.join(',')).join(' ')} fill="rgba(0,0,0,.02)" stroke="var(--aee-accent)" strokeWidth="2" className="pointer-events-auto cursor-move" onMouseDown={dragMove}/>
      <line x1={topMid[0]} y1={topMid[1]} x2={rotateAt[0]} y2={rotateAt[1]} stroke="var(--aee-accent)" strokeWidth="2"/>
      <circle aria-label={t('free-transform-rotate-handle')} cx={rotateAt[0]} cy={rotateAt[1]} r="8" fill="var(--aee-accent)" stroke="white" strokeWidth="2" className="pointer-events-auto cursor-grab" onMouseDown={dragRotate}/>
      {HANDLES.map(([id, hx, hy, cursor]) => { const p = css(handlePoint(geometry, hx, hy)); return <rect key={id} x={p[0] - 6} y={p[1] - 6} width="12" height="12" fill="var(--aee-accent)" stroke="white" strokeWidth="2" style={{cursor}} className="pointer-events-auto" onMouseDown={dragScale(hx, hy)}/>; })}
      <line x1={pivot[0] - 8} y1={pivot[1]} x2={pivot[0] + 8} y2={pivot[1]} stroke="var(--aee-accent)" strokeWidth="2.33"/>
      <line x1={pivot[0]} y1={pivot[1] - 8} x2={pivot[0]} y2={pivot[1] + 8} stroke="var(--aee-accent)" strokeWidth="2.33"/>
    </svg>
  </div>;
}
