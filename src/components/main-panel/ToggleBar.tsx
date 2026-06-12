import type {MouseEvent as ReactMouseEvent} from 'react';
import type {AeeState, DragMode} from '@/core/types';
import {t} from '@/i18n/i18n';
import {getElementOverlayAnchor} from '@/core/overlay';
import {
  closeOpacityOverlay,
  openOpacityOverlay,
  openSelectedLayerColorPicker,
  resetSelectedTransforms,
  toggleCollapse,
  togglePartsOpen,
  toggleTransformOverlay,
} from '@/controllers/uiController';
import {ChevronIcon} from '@/components/icons/ChevronIcon';
import {ColorIcon} from '@/components/icons/ColorIcon';
import {LayersIcon} from '@/components/icons/LayersIcon';
import {MoveIcon} from '@/components/icons/MoveIcon';
import {OpacityIcon} from '@/components/icons/OpacityIcon';
import {ResetIcon} from '@/components/icons/ResetIcon';
import {RotateIcon} from '@/components/icons/RotateIcon';
import {ScaleIcon} from '@/components/icons/ScaleIcon';
import {SkewIcon} from '@/components/icons/SkewIcon';
import {ToggleIconButton} from '@/components/main-panel/ToggleIconButton';

export function ToggleBar({state}: { state: AeeState }) {
  const openTransform = (mode: Exclude<DragMode, null>) => (event: ReactMouseEvent<HTMLButtonElement>) => {
    toggleTransformOverlay(mode, getElementOverlayAnchor(event.currentTarget));
  };
  const openParts = (event: ReactMouseEvent<HTMLButtonElement>) => {
    togglePartsOpen(undefined, getElementOverlayAnchor(event.currentTarget));
  };
  const openOpacity = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (state.opacityOverlay.open) {
      closeOpacityOverlay();
      return;
    }
    openOpacityOverlay(getElementOverlayAnchor(event.currentTarget));
  };

  return <div
    className="pointer-events-auto z-1000000 flex flex-col items-center gap-1 rounded-r-md border border-l-0 border-zinc-700 bg-zinc-950 px-0.5 py-1">
    {state.collapsed ? <div className="flex flex-col items-center gap-1">
      <ToggleIconButton active={state.partsOpen} title={t('toggle-bar-parts-button-title')}
                        onClick={openParts}><LayersIcon/></ToggleIconButton>
      <ToggleIconButton active={state.transformOverlay.mode === 'xy' || state.activeDrag === 'xy'} title={t('toggle-bar-position-button-title')}
                        onClick={openTransform('xy')}><MoveIcon/></ToggleIconButton>
      <ToggleIconButton active={state.transformOverlay.mode === 'rot' || state.activeDrag === 'rot'} title={t('toggle-bar-rotation-button-title')}
                        onClick={openTransform('rot')}><RotateIcon/></ToggleIconButton>
      <ToggleIconButton active={state.transformOverlay.mode === 'scale' || state.activeDrag === 'scale'}
                        title={t('toggle-bar-scale-button-title')} onClick={openTransform('scale')}><ScaleIcon/></ToggleIconButton>
      <ToggleIconButton active={state.transformOverlay.mode === 'skew' || state.activeDrag === 'skew'} title={t('toggle-bar-skew-button-title')}
                        onClick={openTransform('skew')}><SkewIcon/></ToggleIconButton>
      <ToggleIconButton active={state.colorPicker.open && !state.colorPicker.bcMode} title={t('toggle-bar-color-picker-button-title')}
                        onClick={() => openSelectedLayerColorPicker()}><ColorIcon/></ToggleIconButton>
      <ToggleIconButton active={state.opacityOverlay.open} title={t('toggle-bar-opacity-button-title')}
                        onClick={openOpacity}><OpacityIcon/></ToggleIconButton>
      <ToggleIconButton active={false} title={t('toggle-bar-reset-transforms-button-title')}
                        onClick={() => resetSelectedTransforms()}><ResetIcon/></ToggleIconButton>
    </div> : null}
    <button className="flex h-7 w-5 items-center justify-center text-zinc-400 hover:text-violet-300"
            onClick={toggleCollapse}>
      <ChevronIcon direction={state.collapsed ? 'right' : 'left'} size={12}/>
    </button>
  </div>;
}
