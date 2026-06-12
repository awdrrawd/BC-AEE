import {useRef} from 'react';
import type {AeeState} from '@/core/types';
import {t} from '@/i18n/i18n';
import {
  CTRL_BTN_SIZE,
  CTRL_ICON_MAIN,
  moveCharControl,
  toggleBgSubOpen,
  toggleCharControlOpen,
  toggleExpandDirection,
  toggleGridBg,
  toggleHide,
  toggleHideSubOpen,
  toggleImageBg,
  toggleOffsetPanel,
  togglePoseWindow,
  toggleSolidBg,
  toggleSubDirection,
} from '@/controllers/viewController';
import {openBgSettings} from '@/controllers/backgroundController';
import {BgIcon} from '@/components/icons/BgIcon';
import {CloseupIcon} from '@/components/icons/CloseupIcon';
import {FullBodyIcon} from '@/components/icons/FullBodyIcon';
import {HideIcon} from '@/components/icons/HideIcon';
import {OffsetIcon} from '@/components/icons/OffsetIcon';
import {PoseIcon} from '@/components/icons/PoseIcon';
import {ControlButton} from '@/components/view-controls/ControlButton';
import {DirectionButton} from '@/components/view-controls/DirectionButton';

export function CharControl({state}: { state: AeeState }) {
  const drag = useRef<{
    pointerId: number;
    sx: number;
    sy: number;
    left: number;
    top: number;
    moved: boolean
  } | null>(null);
  const left = state.charControl.left ?? state.canvasRect!.width * 0.01;
  const top = state.charControl.top ?? state.canvasRect!.height * 0.87;
  const expandedStyle = state.charControl.expandUp
    ? {left: 0, bottom: CTRL_BTN_SIZE + 8, flexDirection: 'column-reverse' as const}
    : {left: 0, top: CTRL_BTN_SIZE + 8, flexDirection: 'column' as const};
  const subSide = state.charControl.subLeft
    ? {right: CTRL_BTN_SIZE + 6, left: 'auto', flexDirection: 'row-reverse' as const}
    : {left: CTRL_BTN_SIZE + 6, right: 'auto', flexDirection: 'row' as const};

  return <div className="fixed z-999995 pointer-events-none overflow-visible" style={{
    left: state.canvasRect!.left,
    top: state.canvasRect!.top,
    width: state.canvasRect!.width,
    height: state.canvasRect!.height
  }}>
    <div className="absolute pointer-events-none" style={{left, top, width: CTRL_BTN_SIZE, height: CTRL_BTN_SIZE}}>
      <button
        className="pointer-events-auto absolute inset-0 cursor-grab overflow-hidden rounded-lg border-0 bg-transparent p-0 active:cursor-grabbing active:opacity-85"
        title={t('char-control-main-button-title')}
        onPointerDown={event => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {pointerId: event.pointerId, sx: event.clientX, sy: event.clientY, left, top, moved: false};
        }}
        onPointerMove={event => {
          if (!drag.current || drag.current.pointerId !== event.pointerId) return;
          const dx = event.clientX - drag.current.sx;
          const dy = event.clientY - drag.current.sy;
          if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.current.moved = true;
          if (drag.current.moved) moveCharControl(drag.current.left + dx, drag.current.top + dy);
        }}
        onPointerUp={event => {
          if (!drag.current || drag.current.pointerId !== event.pointerId) return;
          if (drag.current && !drag.current.moved) toggleCharControlOpen();
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          drag.current = null;
        }}
        onPointerCancel={event => {
          if (!drag.current || drag.current.pointerId !== event.pointerId) return;
          drag.current = null;
        }}
        onLostPointerCapture={event => {
          if (drag.current?.pointerId === event.pointerId) drag.current = null;
        }}
      >
        <img className="pointer-events-none block h-full w-full" src={CTRL_ICON_MAIN} alt="AEE"/>
      </button>
      <div className={`${state.charControl.open ? 'flex' : 'hidden'} pointer-events-none absolute items-start gap-1.5`}
           style={expandedStyle}>
        <div className="flex pointer-events-auto">
          <ControlButton
            active={state.offset.open || state.offset.x !== 0 || state.offset.y !== 0 || state.offset.scale !== 1}
            label={t('char-control-offset-button')} icon={<OffsetIcon/>} onClick={() => toggleOffsetPanel()}/>
        </div>
        <div className="relative flex pointer-events-auto">
          <ControlButton
            active={state.charControl.bgSubOpen || state.bg.enabled || state.bg.gridEnabled || state.bg.imageEnabled}
            label={t('char-control-background-button')} icon={<BgIcon/>} onClick={toggleBgSubOpen}/>
          <div className={`${state.charControl.bgSubOpen ? 'flex' : 'hidden'} pointer-events-auto absolute top-0 gap-1`}
               style={subSide}>
            <ControlButton active={state.bg.enabled} label={t('char-control-solid-background-button')}
                           icon={<span className="h-5 w-5 rounded bg-white/80"/>} onClick={toggleSolidBg}/>
            <ControlButton active={state.bg.gridEnabled} label={t('char-control-grid-background-button')}
                           icon={<span className="text-lg text-white">▦</span>} onClick={toggleGridBg}/>
            <ControlButton active={state.bg.imageEnabled && state.bg.imageLoaded} label={t('char-control-image-background-button')} icon={<BgIcon/>}
                           onClick={toggleImageBg}/>
            <ControlButton active={state.bg.settingsOpen} label={t('char-control-background-settings-button')}
                           icon={<span className="text-lg text-white">⚙</span>} onClick={() => openBgSettings()}/>
          </div>
        </div>
        <div className="flex pointer-events-auto">
          <ControlButton active={state.pose.open} label={t('char-control-pose-button')} icon={<PoseIcon/>}
                         onClick={() => togglePoseWindow()}/>
        </div>
        <div className="relative flex pointer-events-auto">
          <ControlButton active={state.hideCloseup || state.hideFullbody} label={t('char-control-hide-menu-button')}
                         icon={<HideIcon active={state.hideCloseup || state.hideFullbody}/>}
                         onClick={toggleHideSubOpen}/>
          <div
            className={`${state.charControl.hideSubOpen ? 'flex' : 'hidden'} pointer-events-auto absolute top-0 gap-1`}
            style={subSide}>
            <ControlButton active={state.hideFullbody} label={t('char-control-hide-fullbody-button')}
                           icon={<FullBodyIcon active={state.hideFullbody}/>} onClick={() => toggleHide('fullbody')}/>
            <ControlButton active={state.hideCloseup} label={t('char-control-hide-closeup-button')}
                           icon={<CloseupIcon active={state.hideCloseup}/>} onClick={() => toggleHide('closeup')}/>
          </div>
        </div>
        <div className="flex gap-0.5 pointer-events-auto">
          <DirectionButton direction={state.charControl.expandUp ? 'up' : 'down'} onClick={toggleExpandDirection}/>
          <DirectionButton direction={state.charControl.subLeft ? 'left' : 'right'} onClick={toggleSubDirection}/>
        </div>
      </div>
    </div>
  </div>;
}
