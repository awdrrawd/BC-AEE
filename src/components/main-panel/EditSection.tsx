import type {AeeState, LayerId} from '@/core/types';
import {t} from '@/i18n/i18n';
import {getAssetBaseXY, getLayerColor, getLayerDisplayName, getLayerOverride, isGroupLocked} from '@/core/bc';
import {openLayerColorPicker, setOpacity, setScaleLock, stepOpacity} from '@/controllers/uiController';
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
      <PropGroup title={t('edit-section-position-group-title')} dragMode="xy"
                 dragLabel={t('edit-section-position-drag-label')} activeDrag={state.activeDrag}>
        <PropRow label="X" value={x} ctrl="x" deltas={[-5, -1, 1, 5]}/>
        <PropRow label="Y" value={y} ctrl="y" deltas={[-5, -1, 1, 5]}/>
      </PropGroup>
      <PropGroup title={t('edit-section-rotation-group-title')} dragMode="rot"
                 dragLabel={t('edit-section-rotation-drag-label')} activeDrag={state.activeDrag}>
        <PropRow label="°" value={rotation} ctrl="rot" deltas={[-5, -1, 1, 5]}/>
      </PropGroup>
      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-xs font-bold tracking-wide text-zinc-100">{t('edit-section-scale-group-title')}</span>
          <button
            className={`flex h-6 w-6 items-center justify-center rounded border transition ${state.scaleLock ? 'border-teal-300 bg-teal-400/10 text-teal-300' : 'border-zinc-700 text-zinc-400 hover:border-teal-300 hover:text-teal-300'}`}
            onClick={() => setScaleLock()}>
            <svg version="1.2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 980 980" width="14" height="14"
                 fill="currentColor">
              <path
                d="m697 1.57c-5.77 0.81-15.45 2.65-21.5 4.09-6.05 1.44-16.06 4.35-22.25 6.48-6.19 2.12-16.31 6.12-22.5 8.89-6.19 2.77-15.98 7.78-21.75 11.14-5.77 3.36-14.09 8.63-18.48 11.72-4.39 3.08-13.17 10.32-19.5 16.08-6.34 5.75-37.56 36.35-69.4 68-31.83 31.64-72.07 72.15-89.42 90.03-17.36 17.87-35.36 36.77-40 42-4.64 5.23-9.58 11.75-10.98 14.5l-2.54 5c7.61-1.24 14.77-2.27 20.82-3.09 6.49-0.87 18.8-1.49 30-1.49 10.45 0 23.27 0.48 28.5 1.06 5.23 0.59 13.77 1.74 19 2.56 5.23 0.82 18.05 3.56 28.5 6.08l19 4.58c31.77-31.54 60.35-59.85 84-83.26 23.65-23.42 47.5-46.79 53-51.95 5.5-5.16 13.38-12.05 17.5-15.31 4.13-3.27 10.65-7.51 14.5-9.43 3.85-1.92 11.5-4.99 17-6.81 5.5-1.82 13.6-4.08 18-5.04 5.59-1.21 12.52-1.73 23-1.73 10.68 0 17.31 0.51 23 1.77 4.4 0.98 11.38 2.91 15.5 4.29 4.13 1.39 10.65 4.1 14.5 6.02 3.85 1.93 10.15 5.53 14 8.01 3.85 2.48 10.38 7.31 14.5 10.74 4.13 3.42 11.06 10 15.41 14.61 4.35 4.62 10.27 11.54 13.16 15.39 2.88 3.85 6.84 9.93 8.8 13.5 1.96 3.57 4.89 10.1 6.5 14.5 1.62 4.4 3.68 11.82 4.58 16.5 0.9 4.68 1.9 14.35 2.23 21.5 0.33 7.21 0.09 18.13-0.53 24.5-0.62 6.32-2.05 15.1-3.18 19.5-1.13 4.4-3.75 11.6-5.82 16-2.07 4.4-5.6 10.7-7.85 14-2.25 3.3-11.42 13.88-20.39 23.5-8.96 9.63-46.02 47.21-82.35 83.52-36.33 36.31-73.04 72.5-81.56 80.41-8.52 7.92-18.65 16.77-22.5 19.67-3.85 2.91-10.37 6.85-14.5 8.76-4.12 1.91-10.87 4.61-15 5.99-4.12 1.38-11.33 3.32-16 4.3-5.81 1.23-12.77 1.8-22 1.78-8.57-0.01-16.79-0.64-22.5-1.74-4.95-0.95-14.62-3.52-21.5-5.71-7.36-2.35-15.58-5.8-20-8.41-4.12-2.43-13.57-9.23-21-15.1-7.43-5.87-16.2-12.29-19.5-14.26-3.3-1.98-8.48-4.45-11.5-5.51-3.02-1.05-8.87-2.13-13-2.4-4.84-0.32-10.16 0.07-15 1.1-4.12 0.87-10.43 3.02-14 4.77-4.6 2.26-8.99 5.69-15.02 11.76-5.99 6.02-9.47 10.5-11.69 15.07-1.75 3.58-3.69 8.75-4.33 11.5-0.64 2.75-1.19 9.05-1.23 14-0.06 6.67 0.48 10.68 2.07 15.5 1.18 3.58 4.02 9.42 6.3 13 2.29 3.58 8.04 10.48 12.78 15.35 4.74 4.86 12 11.58 16.12 14.92 4.13 3.34 12 9.04 17.5 12.68 5.5 3.64 15.4 9.37 22 12.74 6.6 3.37 16.5 7.92 22 10.11 5.5 2.18 14.73 5.38 20.5 7.1 5.77 1.73 16.13 4.22 23 5.54 6.88 1.33 17.45 2.9 23.5 3.49 6.05 0.59 16.4 1.07 23 1.06 6.6-0.02 16.27-0.47 21.5-1.01 5.23-0.54 13.55-1.68 18.5-2.52 4.95-0.84 14.17-2.83 20.5-4.43 6.33-1.6 15.55-4.33 20.5-6.07 4.95-1.74 13.95-5.38 20-8.08 6.05-2.7 16.4-8.08 23-11.95 6.6-3.87 15.6-9.72 20-12.99 4.4-3.28 15.2-12.64 24-20.81 8.8-8.17 37.6-36.41 64-62.75 26.4-26.35 60.8-61.17 76.44-77.39 15.65-16.22 34.55-36.16 42-44.3 7.46-8.15 15.64-17.83 18.18-21.5 2.54-3.68 7.05-11.19 10.01-16.69 2.97-5.5 7.37-14.27 9.78-19.5 2.41-5.23 6.16-14.23 8.32-20 2.17-5.77 5.22-15.45 6.78-21.5 1.56-6.05 3.55-17.07 4.41-24.5 0.99-8.45 1.58-21.91 1.58-36 0-13.8-0.59-27.53-1.52-35.5-0.84-7.15-2.61-17.28-3.94-22.5-1.32-5.22-3.84-13.55-5.59-18.5-1.75-4.95-5.26-13.72-7.8-19.5-2.54-5.78-7.7-15.9-11.48-22.5-3.78-6.6-10.08-16.5-14-22-3.92-5.5-11-14.5-15.75-20-4.74-5.5-12.62-13.84-17.52-18.53-4.89-4.69-13.17-11.94-18.4-16.11-5.23-4.18-13.55-10.3-18.5-13.6-4.95-3.31-13.16-8.32-18.25-11.14-5.09-2.81-13.19-6.89-18-9.06-4.81-2.16-12.58-5.34-17.25-7.07-4.67-1.73-13.9-4.44-20.5-6.02-6.6-1.59-16.73-3.63-22.5-4.53-7.06-1.11-18.86-1.76-36-2-18.73-0.26-28.29 0.04-36 1.13zm-322 320.01c-5.23 0.83-14.9 2.89-21.5 4.58-6.6 1.69-17.62 5.14-24.5 7.66-6.87 2.51-19.48 8.06-28 12.31-8.52 4.25-19.55 10.4-24.5 13.67-4.95 3.26-14.62 11.08-21.5 17.37-6.87 6.3-26.21 24.69-42.96 40.89-16.76 16.19-50.71 49.69-75.44 74.44-24.73 24.75-53.51 54-63.94 65-10.44 11-22.17 24.27-26.07 29.5-3.91 5.23-9.66 13.77-12.78 19-3.13 5.23-8.25 14.9-11.4 21.5-3.14 6.6-7.89 18.64-10.56 26.75-2.67 8.11-5.95 20.26-7.29 27-1.35 6.74-2.98 16.98-3.63 22.75-0.74 6.57-0.99 18.74-0.68 32.5 0.38 16.57 1.06 25.08 2.74 34.5 1.22 6.87 3.77 18.12 5.66 25 1.89 6.87 5.49 17.67 8.01 24 2.51 6.33 7.2 16.67 10.41 23 3.22 6.33 8.84 16 12.5 21.5 3.66 5.5 9.34 13.37 12.62 17.5 3.29 4.12 9.88 11.74 14.65 16.92 4.76 5.18 13.83 13.85 20.16 19.28 6.33 5.43 16.22 13.17 22 17.21 5.78 4.05 15.22 10.07 21 13.39 5.78 3.32 15.68 8.37 22 11.23 6.32 2.86 16.68 6.93 23 9.04 6.32 2.11 17.13 4.95 24 6.32 6.88 1.37 17.45 2.96 23.5 3.55 6.05 0.59 19.32 1.07 29.5 1.06 10.18 0 24.35-0.68 31.5-1.52 7.15-0.84 16.82-2.42 21.5-3.52 4.68-1.1 12.1-3.17 16.5-4.6 4.4-1.43 12.73-4.52 18.5-6.86 5.77-2.33 15.68-6.84 22-10.01 6.32-3.18 15.55-8.28 20.5-11.35 4.95-3.07 13.5-9.48 19-14.24 5.5-4.75 19.23-17.35 30.5-27.98 11.27-10.63 41.89-40.72 68.04-66.87 26.14-26.15 56.52-57.01 67.5-68.57 10.98-11.57 24.88-26.42 30.89-33 6.01-6.59 13.55-15.24 16.75-19.23 3.2-3.99 5.82-7.7 5.82-8.25 0-0.55-1.91-1-4.25-1.01-2.34 0-11 0.72-19.25 1.61-11.03 1.18-19.89 1.46-33.5 1.03-10.17-0.32-23.67-1.29-30-2.15-6.33-0.86-16-2.47-21.5-3.59-5.5-1.12-15.85-3.61-23-5.53l-13-3.49c-87.57 87.34-120.43 119.66-129.5 128.17-9.07 8.51-20.1 18.57-24.5 22.36-5.24 4.51-11.11 8.36-17 11.17-4.95 2.35-11.93 5.19-15.5 6.29-3.57 1.11-9.2 2.6-12.5 3.31-3.74 0.81-13.33 1.3-25.5 1.3-12.03 0-22.37-0.52-27-1.35-4.13-0.74-11.1-2.48-15.5-3.85-4.4-1.38-11.15-4.09-15-6.03-3.85-1.93-10.15-5.64-14-8.24-3.85-2.6-10.6-8-15-12.01-4.4-4-11.3-10.93-15.33-15.39-4.04-4.45-9.73-11.7-12.65-16.1-2.91-4.4-6.99-11.37-9.05-15.5-2.07-4.12-5.05-11.33-6.63-16-1.58-4.67-3.54-12.1-4.37-16.5-0.86-4.59-1.49-13.65-1.48-21.25 0.01-8.86 0.64-16.48 1.9-23 1.05-5.36 3.11-13.35 4.59-17.75 1.47-4.4 4.15-11.15 5.95-15 1.8-3.85 5.29-9.7 7.75-13 2.46-3.3 8.92-10.95 14.36-17 5.44-6.05 41.4-42.65 79.92-81.34 38.52-38.69 77.39-77.17 86.37-85.5 8.98-8.34 19.56-17.57 23.5-20.52 3.94-2.95 10.77-7.08 15.17-9.17 4.4-2.1 12.05-5.17 17-6.83 4.95-1.66 13.05-3.71 18-4.57 4.95-0.86 14.18-1.57 20.5-1.58 6.32 0 15.55 0.69 20.5 1.54 4.95 0.85 13.73 3.16 19.5 5.13 5.77 1.96 13.87 5.27 18 7.34 4.12 2.07 11.1 6.49 15.5 9.83 4.4 3.33 12.05 9.23 17 13.11 4.95 3.88 12.6 8.83 17 11 4.4 2.17 10.92 4.46 14.5 5.09 3.58 0.63 8.98 0.86 12 0.52 3.02-0.34 7.75-1.11 10.5-1.71 2.75-0.59 8.15-2.71 12-4.69 4.6-2.37 9.6-6.19 14.57-11.13 5.87-5.83 8.51-9.43 11.72-16.02 3.18-6.49 4.41-10.51 5.24-17 0.78-6.04 0.78-10.45 0.03-15.25-0.58-3.71-1.81-8.66-2.73-11-0.91-2.34-3.68-7.4-6.14-11.25-2.46-3.85-8.35-10.83-13.09-15.51-4.73-4.68-13.77-12.39-20.1-17.14-6.33-4.76-16.9-11.92-23.5-15.93-6.6-4.01-16.05-9.19-21-11.51-4.95-2.33-13.27-5.66-18.5-7.39-5.23-1.74-14.9-4.48-21.5-6.08-6.6-1.61-17.85-3.86-25-5.02-9.95-1.6-18.87-2.18-38-2.47-18.95-0.29-27.3-0.01-34.5 1.13z"/>
            </svg>
          </button>
          <DragCheck mode="scale" label={t('edit-section-scale-drag-label')} activeDrag={state.activeDrag}/>
        </div>
        <PropRow label="X" value={sx.toFixed(2)} ctrl="sx" deltas={[-0.3, -0.1, 0.1, 0.3]}/>
        <PropRow label="Y" value={sy.toFixed(2)} ctrl="sy" deltas={[-0.3, -0.1, 0.1, 0.3]}/>
      </div>
      <PropGroup title={t('edit-section-skew-group-title')} dragMode="skew"
                 dragLabel={t('edit-section-skew-drag-label')} activeDrag={state.activeDrag}>
        <PropRow label="X°" value={(layerOverride.SkewX ?? 0).toFixed(1)} ctrl="skx" deltas={[-5, -1, 1, 5]}/>
        <PropRow label="Y°" value={(layerOverride.SkewY ?? 0).toFixed(1)} ctrl="sky" deltas={[-5, -1, 1, 5]}/>
      </PropGroup>
      <MirrorGroup layerOverride={layerOverride}/>
    </>}
  </Section>;
}
