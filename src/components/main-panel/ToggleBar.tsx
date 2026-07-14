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
import {IconButton} from '@/components/ui/Button';
import {Blend, ChevronLeft, ChevronRight, Italic, Layers, Move, Palette, RotateCcw, RotateCw, Scaling} from 'lucide-react';

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
    className="pointer-events-auto z-1000000 flex flex-col items-center gap-1 rounded-r-md border border-l-0 border-(--aee-accent-35) bg-(--aee-panel-bg) px-0.5 py-1">
    {state.collapsed ? <div className="flex flex-col items-center gap-1">
      <IconButton selected={state.partsOpen} title={t('toggle-bar-parts-button-title')} icon={<Layers className="h-4 w-4"/>}
                  onClick={openParts}/>
      <IconButton selected={state.transformOverlay.mode === 'xy' || state.activeDrag === 'xy'}
                  title={t('toggle-bar-position-button-title')} icon={<Move className="h-4 w-4"/>} onClick={openTransform('xy')}/>
      <IconButton selected={state.transformOverlay.mode === 'rot' || state.activeDrag === 'rot'}
                  title={t('toggle-bar-rotation-button-title')} icon={<RotateCw className="h-4 w-4"/>} onClick={openTransform('rot')}/>
      <IconButton selected={state.transformOverlay.mode === 'scale' || state.activeDrag === 'scale'}
                  title={t('toggle-bar-scale-button-title')} icon={<Scaling className="h-4 w-4"/>} onClick={openTransform('scale')}/>
      <IconButton selected={state.transformOverlay.mode === 'skew' || state.activeDrag === 'skew'}
                  title={t('toggle-bar-skew-button-title')} icon={<Italic className="h-4 w-4"/>} onClick={openTransform('skew')}/>
      <IconButton selected={state.colorPicker.open && !state.colorPicker.bcMode}
                  title={t('toggle-bar-color-picker-button-title')} icon={<Palette className="h-4 w-4"/>}
                  onClick={() => openSelectedLayerColorPicker()}/>
      <IconButton selected={state.opacityOverlay.open} title={t('toggle-bar-opacity-button-title')}
                  icon={<Blend className="h-4 w-4"/>} onClick={openOpacity}/>
      <IconButton title={t('toggle-bar-reset-transforms-button-title')} icon={<RotateCcw className="h-4 w-4"/>}
                  onClick={() => resetSelectedTransforms()}/>
    </div> : null}
    <IconButton className="w-5 border-0" tone="ghost" title={t('toggle-bar-parts-button-title')}
                icon={state.collapsed ? <ChevronRight className="h-3 w-3"/> : <ChevronLeft className="h-3 w-3"/>}
                onClick={toggleCollapse}/>
  </div>;
}
