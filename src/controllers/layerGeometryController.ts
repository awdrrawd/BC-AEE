import type {AeeState} from '@/core/types';
import {type CapturedLayerGeometry, getCapturedLayerGeometry} from '@/controllers/appearancePickerController';

function unionGeometry(geometries: CapturedLayerGeometry[]): CapturedLayerGeometry | null {
  const points = geometries.flatMap(geometry => geometry.corners);
  if (!points.length) return null;
  const left = Math.min(...points.map(point => point[0]));
  const top = Math.min(...points.map(point => point[1]));
  const right = Math.max(...points.map(point => point[0]));
  const bottom = Math.max(...points.map(point => point[1]));
  const center: [number, number] = [(left + right) / 2, (top + bottom) / 2];
  return {
    corners: [[left, top], [right, top], [right, bottom], [left, bottom]],
    center,
    pivot: center,
    width: right - left,
    height: bottom - top,
  };
}

export function getSelectedLayerGeometry(state: AeeState): CapturedLayerGeometry | null {
  if (state.selectedLayer === null) return null;
  if (state.selectedLayer !== 'all') return getCapturedLayerGeometry(Number.parseInt(state.selectedLayer, 10));
  return unionGeometry(state.layers.map((_, index) => getCapturedLayerGeometry(index)).filter((value): value is CapturedLayerGeometry => !!value));
}
