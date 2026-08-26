import {useRef} from 'react';
import type {AeeState} from '@/core/types';
import {t} from '@/i18n/i18n';
import {
  commitCharControlPos,
  CTRL_BTN_SIZE,
  CTRL_FRAME_PAW_STYLE,
  moveCharControl,
  toggleBgSubOpen,
  toggleCharControlOpen,
  toggleGridBg,
  toggleHide,
  toggleHideSubOpen,
  toggleImageBg,
  toggleOffsetPanel,
  togglePoseWindow,
  toggleSolidBg,
} from '@/controllers/viewController';
import {openBgSettings} from '@/controllers/backgroundController';
import {ControlButton} from '@/components/view-controls/ControlButton';
import {Accessibility, Eye, EyeOff, Grid3x3, ImageIcon, Move, PersonStanding, Settings, User} from '@/components/view-controls/Icons';
import {settings, useSetting} from '@/core/settings';

export function CharControl({state}: { state: AeeState }) {
  const bgEnabled = useSetting(settings.bgEnabled);
  const bgGridEnabled = useSetting(settings.bgGridEnabled);
  const bgImgEnabled = useSetting(settings.bgImgEnabled);
  const charOffsetX = useSetting(settings.charOffsetX);
  const charOffsetY = useSetting(settings.charOffsetY);
  const charScale = useSetting(settings.charScale);
  const hideCloseup = useSetting(settings.hideCloseup);
  const hideFullbody = useSetting(settings.hideFullbody);
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
  // The side-toolbar version always grows upward and to the right. Direction
  // controls were removed so the layout is stable at every canvas scale.
  const expandedStyle = {left: 0, bottom: CTRL_BTN_SIZE + 8, flexDirection: 'column-reverse' as const};
  const subSide = {left: CTRL_BTN_SIZE + 6, right: 'auto', flexDirection: 'row' as const};

  return <div className="fixed z-1000001 pointer-events-none overflow-visible" style={{
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
          if (drag.current.moved) moveCharControl(drag.current.left + dx, drag.current.top + dy, false);
        }}
        onPointerUp={event => {
          if (!drag.current || drag.current.pointerId !== event.pointerId) return;
          if (drag.current.moved) commitCharControlPos();
          else toggleCharControlOpen();
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
        <span className="pointer-events-none block h-full w-full" style={CTRL_FRAME_PAW_STYLE} aria-label="AEE"/>
      </button>
      <div className={`${state.charControl.open ? 'flex' : 'hidden'} pointer-events-none absolute items-start gap-1.5`}
           style={expandedStyle}>
        <div className="flex pointer-events-auto">
          <ControlButton
            active={state.offset.open || charOffsetX !== 0 || charOffsetY !== 0 || charScale !== 1}
            label={t('char-control-offset-button')} icon={<Move className="h-full w-full"/>} onClick={() => toggleOffsetPanel()}/>
        </div>
        <div className="relative flex pointer-events-auto">
          <ControlButton
            active={state.charControl.bgSubOpen || bgEnabled || bgGridEnabled || bgImgEnabled}
            label={t('char-control-background-button')} icon={<ImageIcon className="h-full w-full"/>}
            onClick={toggleBgSubOpen}/>
          <div className={`${state.charControl.bgSubOpen ? 'flex' : 'hidden'} pointer-events-auto absolute top-0 gap-1`}
               style={subSide}>
            <ControlButton active={bgEnabled} label={t('char-control-solid-background-button')}
                           icon={<span className="h-5 w-5 rounded bg-white/80"/>} onClick={toggleSolidBg}/>
            <ControlButton active={bgGridEnabled} label={t('char-control-grid-background-button')}
                           icon={<Grid3x3 className="h-full w-full"/>} onClick={toggleGridBg}/>
            <ControlButton active={bgImgEnabled && state.bg.imageLoaded}
                           label={t('char-control-image-background-button')}
                           icon={<ImageIcon className="h-full w-full"/>}
                           onClick={toggleImageBg}/>
            <ControlButton active={state.bg.settingsOpen} label={t('char-control-background-settings-button')}
                           icon={<Settings className="h-full w-full"/>} onClick={() => openBgSettings()}/>
          </div>
        </div>
        <div className="flex pointer-events-auto">
          <ControlButton active={state.pose.open} label={t('char-control-pose-button')} icon={<Accessibility className="h-full w-full"/>}
                         onClick={() => togglePoseWindow()}/>
        </div>
        <div className="relative flex pointer-events-auto">
          <ControlButton active={hideCloseup || hideFullbody} label={t('char-control-hide-menu-button')}
                         icon={hideCloseup || hideFullbody ? <EyeOff className="h-full w-full"/> : <Eye className="h-full w-full"/>}
                         onClick={toggleHideSubOpen}/>
          <div
            className={`${state.charControl.hideSubOpen ? 'flex' : 'hidden'} pointer-events-auto absolute top-0 gap-1`}
            style={subSide}>
            <ControlButton active={hideFullbody} label={t('char-control-hide-fullbody-button')}
                           icon={<PersonStanding className="h-full w-full"/>} onClick={() => toggleHide('fullbody')}/>
            <ControlButton active={hideCloseup} label={t('char-control-hide-closeup-button')}
                           icon={<User className="h-full w-full"/>} onClick={() => toggleHide('closeup')}/>
          </div>
        </div>
      </div>
    </div>
  </div>;
}
