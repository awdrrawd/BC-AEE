import {type MouseEvent as ReactMouseEvent, type ReactNode, useEffect, useRef, useState} from 'react';
import type {AeeState, EditToolMode} from '@/core/types';
import {getAppearanceScreenSnapshot} from '@/core/appearanceScreenMachine';
import {getElementOverlayAnchor} from '@/core/overlay';
import {
  leaveSelectedPart,
  cycleLayerPickerMode,
  openLayerColorPicker,
  resetSelectedTransforms,
  selectEditTool,
  setToolbarHovered,
  setToolbarLayout,
  setToolbarPinned,
} from '@/controllers/uiController';
import {exportBcxAppearance, importBcxAppearanceWithCategory} from '@/controllers/importExportController';
import {cyclePartsFilterMode, partsFilterIcon, partsFilterTooltip} from '@/controllers/partsFilterController';
import {hideRestraintsIcon, hideRestraintsTooltip, isHideRestraintsActive, toggleHideRestraints} from '@/controllers/hideRestraintsController';
import {LAYER_MANAGER_ICON, toggleLayerManagerPanel} from '@/controllers/layerManagerController';
import {
  toggleBgSubOpen, toggleCharControlOpen, toggleGridBg, toggleHide, toggleHideSubOpen,
  toggleImageBg, toggleOffsetPanel, togglePoseWindow, toggleSolidBg,
} from '@/controllers/viewController';
import {openBgSettings} from '@/controllers/backgroundController';
import {ControlButton} from '@/components/view-controls/ControlButton';
import {settings, useSetting} from '@/core/settings';
import {SettingsTab} from '@/components/main-panel/SettingsTab';
import {EditSection} from '@/components/main-panel/EditSection';
import {LayerList} from '@/components/layers/LayerList';
import {OpacityRow} from '@/components/main-panel/OpacityRow';
import {PriorityRow} from '@/components/main-panel/PriorityRow';
import {OpacityTab} from '@/components/main-panel/OpacityTab';
import {LayersTab} from '@/components/main-panel/LayersTab';
import {LayeringHidePanel} from '@/components/main-panel/LayeringHidePanel';
import {Section} from '@/components/main-panel/Section';
import {getLayerColor, getLayerDisplayName, getOpacity} from '@/core/bc';
import {Panel} from '@/components/ui/Panel';
import {t} from '@/i18n/i18n';
import {
  Accessibility, Download, Eye, EyeOff, FlipHorizontal2, Grid3x3, ImageIcon,
  Layers3, Move, PersonStanding, RotateCcw, Scan, Scaling, Settings, SlidersHorizontal, Undo2, Upload, User,
} from '@/components/main-panel/icons/Icons';
import {getLayeringHideGroups} from '@/controllers/layeringHideController';
import {TiltIcon} from '@/components/main-panel/Icons';
import {RotateIcon, TransparentIcon} from '@/components/main-panel/Icons';

const settingsIcon = new URL('../assets/editor/Settings.svg', import.meta.url).href;
const partIcon = new URL('../assets/editor/part.svg', import.meta.url).href;
const neatIcon = new URL('../assets/editor/mod-Neat.svg', import.meta.url).href;
const freeIcon = new URL('../assets/editor/mod-Free.svg', import.meta.url).href;

type ManagePanel = 'settings' | null;

function ToolButton({title, icon, selected, active, disabled = false, activeTone = 'purple', onClick, className = ''}: {
  title: string;
  icon: ReactNode;
  selected?: boolean;
  active?: boolean;
  disabled?: boolean;
  activeTone?: 'purple' | 'orange';
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  className?: string;
}) {
  return <button
    type="button"
    draggable={false}
    data-aee-tooltip={title}
    aria-label={title}
    aria-pressed={selected || active}
    disabled={disabled}
    className={`relative flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-[8px] border bg-zinc-900/90 text-zinc-200 transition
      ${selected || active
        ? activeTone === 'orange'
          ? '[border-width:2.5px] border-orange-400 text-orange-300 shadow-[0_0_9px_rgba(251,146,60,.65)]'
          : '[border-width:2.5px] border-(--aee-accent) text-(--aee-accent) shadow-[0_0_9px_var(--aee-accent-55)]'
        : 'border-zinc-700 hover:[border-width:2.5px] hover:border-(--aee-accent) hover:bg-(--aee-accent-35) hover:text-white hover:shadow-[0_0_9px_var(--aee-accent-55)]'} ${disabled ? 'cursor-not-allowed opacity-45' : ''} ${className}`}
    onDragStart={event => event.preventDefault()}
    onClick={onClick}>
    <span className="flex h-[34px] w-[34px] items-center justify-center [&>svg]:h-full [&>svg]:w-full [&>img]:h-full [&>img]:w-full [&>img]:object-contain">{icon}</span>
  </button>;
}

function SvgIcon({src}: {src: string}) {
  return <img src={src} alt="" draggable={false} className="invert opacity-90"/>;
}

function GameIcon({src}: {src: string}) {
  return <img src={src} alt="" draggable={false} className="object-contain"/>;
}

export function ToolbarSide({state}: {state: AeeState}) {
  const snapshot = getAppearanceScreenSnapshot();
  const hasAppearanceSelection = !snapshot.inAppearance || !!CharacterAppearanceSelection;
  const editing = state.visible && !!state.item && hasAppearanceSelection;
  const resident = snapshot.inAppearance
    && snapshot.phase === 'groups'
    && !!snapshot.selection
    && !!CharacterAppearanceSelection;
  const eligible = !!state.canvasRect && (editing || resident);
  const [managePanel, setManagePanel] = useState<ManagePanel>(null);
  const [exitMounted, setExitMounted] = useState(eligible);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const lastRectRef = useRef(state.canvasRect);
  const panelWidthRef = useRef(350);
  const controlContentRef = useRef<ReactNode>(null);
  const editingRef = useRef(editing);
  if (state.canvasRect) lastRectRef.current = state.canvasRect;
  if (editing) editingRef.current = true;
  const settingsOpen = managePanel === 'settings' || (editing && state.editTool === 'settings');
  const toolbarAlwaysVisible = useSetting(settings.toolbarAlwaysVisible);
  useEffect(() => {
    if (!settingsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const path = event.composedPath();
      if (toolbarRef.current && path.includes(toolbarRef.current)) return;
      if (path.some(node => node instanceof Element && node.closest('[data-aee-font-panel="true"]'))) return;
      if (editing) selectEditTool('settings');
      else setManagePanel(null);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [editing, settingsOpen]);
  useEffect(() => {
    if (editing || toolbarAlwaysVisible || (!state.toolbarPinned && !state.toolbarHovered)) return;
    const closeTransientToolbar = (event: PointerEvent) => {
      if (event.composedPath().some(node => node instanceof Element && node.matches('[data-aee-root]'))) return;
      if (state.toolbarPinned) setToolbarPinned(false);
      if (state.toolbarHovered) setToolbarHovered(false);
    };
    document.addEventListener('pointerdown', closeTransientToolbar, true);
    return () => document.removeEventListener('pointerdown', closeTransientToolbar, true);
  }, [editing, state.toolbarHovered, state.toolbarPinned, toolbarAlwaysVisible]);
  useEffect(() => {
    if (eligible) {
      setExitMounted(true);
      if (!editing) editingRef.current = false;
      return;
    }
    setManagePanel(null);
    const timer = window.setTimeout(() => {
      setExitMounted(false);
      editingRef.current = false;
    }, 320);
    return () => window.clearTimeout(timer);
  }, [editing, eligible]);
  if ((!eligible && !exitMounted) || !lastRectRef.current) return null;

  const rect = state.canvasRect ?? lastRectRef.current;
  const scale = rect.width / 2000;
  const exiting = !eligible;
  const residentOpen = !exiting && (editing || toolbarAlwaysVisible || state.toolbarHovered || state.toolbarPinned || settingsOpen || state.charControl.open);
  const panelOpen = !exiting && (editing ? state.toolbarLayout === 'neat' || state.editTool === 'settings' : managePanel !== null);
  if (panelOpen) panelWidthRef.current = settingsOpen ? 500 : 350;
  const panelWidth = panelWidthRef.current;
  const controlContent = editing ? <EditControlPanel state={state}/> : <SettingsTab/>;
  const controlPageKey = editing
    ? state.editTool === 'settings' || state.editTool === 'layers' || state.editTool === 'opacity' || state.editTool === 'layeringHide'
      ? state.editTool
      : 'edit'
    : managePanel ?? 'resident';
  if (panelOpen) controlContentRef.current = controlContent;
  const displayEditing = editing || (exiting && editingRef.current);
  const openTool = (tool: EditToolMode) => (event: ReactMouseEvent<HTMLButtonElement>) => {
    selectEditTool(tool, getElementOverlayAnchor(event.currentTarget));
  };

  return <div className="fixed z-1000000 isolate overflow-hidden pointer-events-none" style={{left: rect.left, top: rect.top, width: rect.width, height: rect.height}}>
    <div ref={toolbarRef} className={`aee-toolbar-side absolute left-0 top-0 h-[1000px] w-[130px] ${editing ? '' : 'pointer-events-auto'}`}
         style={{transform: `scale(${scale})`, transformOrigin: 'left top'}}
         onPointerMove={!editing && !toolbarAlwaysVisible && !state.toolbarPinned ? event => {
           const x = (event.clientX - rect.left) / scale;
           if (x <= 120 && !state.toolbarHovered) setToolbarHovered(true);
           else if (x >= 130 && state.toolbarHovered) setToolbarHovered(false);
         } : undefined}
         onPointerLeave={!editing && !toolbarAlwaysVisible && !state.toolbarPinned ? () => setToolbarHovered(false) : undefined}
         onPointerDown={!editing && !toolbarAlwaysVisible ? event => {
           const x = (event.clientX - rect.left) / scale;
           if (event.target === event.currentTarget && x <= 120) {
             event.preventDefault();
             event.stopPropagation();
             if (!state.toolbarPinned) setToolbarPinned(true);
           }
         } : undefined}>
      {!editing ? <button type="button" aria-label={t('settings-appearance-view-control')}
                          className={`pointer-events-auto absolute left-0 top-0 z-40 h-full w-[10px] border-0 p-0 ${residentOpen ? 'bg-transparent' : 'aee-toolbar-glow'}`}
                          onPointerDown={event => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (!state.toolbarPinned) setToolbarPinned(true);
                          }}/> : null}
      <Panel className={`pointer-events-auto absolute bottom-0 left-0 top-0 z-30 w-[80px] flex-col items-center rounded-none border-y-0 border-l-0 px-[9px] py-[12px] [backface-visibility:hidden] ${editing ? '' : 'aee-panel-collapse-motion'}`}
             style={{transform: residentOpen ? 'translate3d(0,0,0)' : 'translate3d(-70px,0,0)', opacity: residentOpen ? 1 : 0}}>
        {displayEditing ? <EditingButtons state={state} openTool={openTool}/> : <ResidentButtons state={state} managePanel={managePanel} setManagePanel={setManagePanel}/>} 
      </Panel>
      <div className={`aee-panel-collapse-motion absolute left-[80px] top-0 z-10 h-[1000px] overflow-hidden ${panelOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
           style={{width: panelWidth, transform: panelOpen ? 'translate3d(0,0,0)' : 'translate3d(calc(-100% - 80px),0,0)', opacity: panelOpen ? 1 : 0}}>
        <Panel className="aee-control flex h-full w-full flex-col overflow-hidden rounded-none border-y-0 border-l-0 p-0">
          <div className="relative flex h-[52px] shrink-0 items-center justify-center border-b border-zinc-700 bg-zinc-950/80">
            <span className="aee-wave-text text-[26px] font-bold">AEE v{state.version}</span>
          </div>
          <div className="aee-scroll min-h-0 flex-1 overscroll-contain overflow-y-auto"
               style={{WebkitOverflowScrolling: 'touch'}}>
            {panelOpen
              ? <div key={controlPageKey} className="aee-panel-page-enter min-h-full">{controlContent}</div>
              : controlContentRef.current}
          </div>
        </Panel>
      </div>
      <ToolbarViewFlyout state={state} open={state.charControl.open}/>
      {editing && state.activeDrag ? <div className="pointer-events-none absolute top-0 w-max font-bold" style={{left: 1000, transform: 'translateX(-50%)'}}>
        <div className="w-max whitespace-nowrap rounded-b-lg border-2 border-t-0 border-(--aee-accent) bg-(--aee-control-bg) px-6 py-2 text-[28px] leading-none text-(--aee-accent) shadow-[0_0_12px_var(--aee-accent-55)] [writing-mode:horizontal-tb]">{dragLabel(state.activeDrag)}</div>
      </div> : null}
    </div>
  </div>;
}

function ToolbarViewFlyout({state, open}: {state: AeeState; open: boolean}) {
  const bgEnabled = useSetting(settings.bgEnabled);
  const bgGridEnabled = useSetting(settings.bgGridEnabled);
  const bgImgEnabled = useSetting(settings.bgImgEnabled);
  const hideCloseup = useSetting(settings.hideCloseup);
  const hideFullbody = useSetting(settings.hideFullbody);
  return <div className={`aee-panel-collapse-motion absolute bottom-[69px] left-[80px] z-40 flex h-[74px] items-center gap-[10px] rounded-r-lg border border-l-0 border-zinc-700 bg-zinc-950/95 p-[5px] shadow-xl ${open ? 'pointer-events-auto translate-x-0 opacity-100' : 'pointer-events-none -translate-x-full opacity-0'}`}>
    <ControlButton active={state.offset.open} label={t('char-control-offset-button')} icon={<Move className="h-full w-full"/>} onClick={() => toggleOffsetPanel()}/>
    <div className="relative">
      <ControlButton active={state.charControl.bgSubOpen || bgEnabled || bgGridEnabled || bgImgEnabled} label={t('char-control-background-button')} icon={<ImageIcon className="h-full w-full"/>} onClick={toggleBgSubOpen}/>
      <div className={`aee-panel-collapse-motion absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 flex-col-reverse gap-[9px] rounded-lg border border-zinc-700 bg-zinc-950/95 p-[5px] shadow-xl ${state.charControl.bgSubOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'}`}>
        <ControlButton active={bgEnabled} label={t('char-control-solid-background-button')} icon={<span className="h-5 w-5 rounded bg-white/80"/>} onClick={toggleSolidBg}/>
        <ControlButton active={bgGridEnabled} label={t('char-control-grid-background-button')} icon={<Grid3x3 className="h-full w-full"/>} onClick={toggleGridBg}/>
        <ControlButton active={bgImgEnabled && state.bg.imageLoaded} label={t('char-control-image-background-button')} icon={<ImageIcon className="h-full w-full"/>} onClick={toggleImageBg}/>
        <ControlButton active={state.bg.settingsOpen} label={t('char-control-background-settings-button')} icon={<Settings className="h-full w-full"/>} onClick={() => openBgSettings()}/>
      </div>
    </div>
    <ControlButton active={state.pose.open} label={t('char-control-pose-button')} icon={<Accessibility className="h-full w-full"/>} onClick={() => togglePoseWindow()}/>
    <div className="relative">
      <ControlButton active={state.charControl.hideSubOpen || hideCloseup || hideFullbody} label={t('char-control-hide-menu-button')} icon={hideCloseup || hideFullbody ? <EyeOff className="h-full w-full"/> : <Eye className="h-full w-full"/>} onClick={toggleHideSubOpen}/>
      <div className={`aee-panel-collapse-motion absolute bottom-full left-1/2 mb-2 flex -translate-x-1/2 flex-col-reverse gap-[9px] rounded-lg border border-zinc-700 bg-zinc-950/95 p-[5px] shadow-xl ${state.charControl.hideSubOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'}`}>
        <ControlButton active={hideFullbody} label={t('char-control-hide-fullbody-button')} icon={<PersonStanding className="h-full w-full"/>} onClick={() => toggleHide('fullbody')}/>
        <ControlButton active={hideCloseup} label={t('char-control-hide-closeup-button')} icon={<User className="h-full w-full"/>} onClick={() => toggleHide('closeup')}/>
      </div>
    </div>
  </div>;
}

function EditControlPanel({state}: {state: AeeState}) {
  if (state.editTool === 'opacity') return <ControlPage title={t('main-panel-tab-opacity')} back><OpacityTab state={state}/></ControlPage>;
  if (state.editTool === 'layers') return <ControlPage title={t('main-panel-tab-layers')} back><LayersTab state={state}/></ControlPage>;
  if (state.editTool === 'layeringHide' && state.item) return <ControlPage title={t('layering-hide-title')} back><LayeringHidePanel item={state.item}/></ControlPage>;
  if (state.editTool === 'settings') return <ControlPage title={t('main-panel-tab-settings')}><SettingsTab/></ControlPage>;
  const layerId = state.selectedLayer;
  if (layerId === null) return <div className="flex min-h-full flex-col">
    <Section title={t('edit-tab-parts-section-title')}>
      <LayerList item={state.item} selectedLayer={state.selectedLayer}/>
    </Section>
  </div>;
  const opacity = Math.round((getOpacity(state.item, layerId) ?? 1) * 100);
  const index = layerId === 'all' ? 0 : Number.parseInt(layerId, 10);
  const layerName = layerId === 'all' ? t('edit-section-all-parts-label') : getLayerDisplayName(state.layers[index], layerId);
  const layerColor = getLayerColor(state.item, layerId);
  return <div className="flex flex-col">
    <div className="border-b border-zinc-700 bg-zinc-900 p-2">
      <div className="grid h-10 grid-cols-[45px_minmax(0,1fr)_45px] items-center gap-2">
        <button type="button" className="flex h-[30px] w-[45px] items-center justify-center rounded border border-(--aee-accent-55) bg-(--aee-control-bg) text-zinc-200 hover:border-(--aee-accent)"
                style={{width: 45, height: 30, minHeight: 30, padding: 0}}
                title={t('main-panel-deselect-button-title')} onClick={leaveSelectedPart}><Undo2 className="h-4.5 w-4.5"/></button>
        <span className="min-w-0 truncate text-center text-sm font-bold text-(--aee-accent)">{layerName}</span>
        <button className="relative h-[30px] w-[45px] shrink-0 justify-self-end overflow-hidden rounded border border-(--aee-accent-55) bg-[repeating-conic-gradient(#222_0%_25%,#111_0%_50%)] bg-size-[6px_6px] hover:border-(--aee-accent)"
                style={{width: 45, height: 30, minHeight: 30, padding: 0}}
                onClick={() => openLayerColorPicker(layerId)}><span className="absolute inset-0" style={layerColor ? {background: layerColor} : undefined}/></button>
      </div>
    </div>
    <div className="divide-y divide-zinc-800">
      <OpacityRow layerId={layerId} name={t('main-panel-tab-opacity')} value={opacity} display={`${opacity}%`}/>
      <PriorityRow item={state.item} layerId={layerId} name={t('main-panel-tab-layers')}/>
      {(['xy', 'rot', 'scale', 'skew', 'mirror'] as const).map(tool => state.editTools.includes(tool)
        ? <EditSection key={tool} state={state} layerId={layerId} toolOnly={tool} showHeader={false}/> : null)}
    </div>
    <Section title={t('edit-tab-parts-section-title')}>
      <LayerList item={state.item} selectedLayer={state.selectedLayer}/>
    </Section>
  </div>;
}

function ControlPage({title, children, back = false}: {title: string; children: ReactNode; back?: boolean}) {
  return <div>
    <div className="relative flex h-[52px] items-center justify-center border-b border-zinc-700 bg-zinc-900 px-3 py-2 text-center text-sm font-bold text-(--aee-accent)">
      {back ? <button type="button"
                      className="absolute left-2 flex h-[30px] w-[45px] items-center justify-center rounded border border-(--aee-accent-55) bg-(--aee-control-bg) text-zinc-200 hover:border-(--aee-accent)"
                      aria-label={t('main-panel-deselect-button-title')} data-aee-tooltip={t('main-panel-deselect-button-title')}
                      onClick={leaveSelectedPart}><Undo2 className="h-4.5 w-4.5"/></button> : null}
      <span>{title}</span>
    </div>
    {children}
  </div>;
}

function ResidentButtons({state, managePanel, setManagePanel}: {state: AeeState; managePanel: ManagePanel; setManagePanel: (panel: ManagePanel) => void}) {
  const appearancePick = useSetting(settings.appearancePick);
  return <>
    <div className="flex flex-col gap-[7px]">
      <ToolButton title={t('menu-export-tooltip')} icon={<Upload/>} onClick={() => exportBcxAppearance(CharacterAppearanceSelection)}/>
      <ToolButton title={t('menu-import-tooltip')} icon={<Download/>} onClick={() => CharacterAppearanceSelection && void importBcxAppearanceWithCategory(CharacterAppearanceSelection)}/>
      <ToolButton title={t('layer-manager-title')} active={state.layerManager.open} icon={<GameIcon src={LAYER_MANAGER_ICON}/>} onClick={() => toggleLayerManagerPanel()}/>
      <ToolButton title={partsFilterTooltip()} active={state.partsFilterMode !== 'all'}
                  activeTone={state.partsFilterMode === 'empty' ? 'orange' : 'purple'}
                  icon={<GameIcon src={partsFilterIcon()}/>} onClick={() => cyclePartsFilterMode()}/>
      <ToolButton title={hideRestraintsTooltip()} active={isHideRestraintsActive()} icon={<GameIcon src={hideRestraintsIcon()}/>} onClick={() => toggleHideRestraints()}/>
      {CurrentScreen === 'Appearance' ?
        <ToolButton title={t('settings-appearance-pick')} active={appearancePick}
                    icon={<Scan/>} onClick={() => settings.appearancePick.toggle()}/> : null}
    </div>
    <div className="mt-auto flex flex-col gap-[7px]">
      <ToolButton title={t('settings-appearance-view-control')} active={state.charControl.open} icon={<SlidersHorizontal/>} onClick={() => toggleCharControlOpen()}/>
      <ToolButton title={t('main-panel-tab-settings')} selected={managePanel === 'settings'} icon={<SvgIcon src={settingsIcon}/>} onClick={() => setManagePanel(managePanel === 'settings' ? null : 'settings')}/>
    </div>
  </>;
}

function EditingButtons({state, openTool}: {state: AeeState; openTool: (tool: EditToolMode) => (event: ReactMouseEvent<HTMLButtonElement>) => void}) {
  const selected = state.selectedLayer !== null;
  const selectedTool = (tool: EditToolMode) => state.toolbarLayout === 'neat'
    ? state.editTools.includes(tool)
    : state.transformOverlay.mode === tool || (state.opacityOverlay.open && tool === 'opacity');
  return <>
    <div className="flex flex-col gap-[7px]">
      <ToolButton title={t('toggle-bar-parts-button-title')} selected={state.partsOpen} icon={<SvgIcon src={partIcon}/>} onClick={openTool('parts')}/>
      <ToolButton title={t(`toolbar-layer-picker-${state.layerPickerMode}`)} disabled={!!state.activeDrag}
                  active={state.layerPickerMode !== 'off'} activeTone={state.layerPickerMode === 'detail' ? 'orange' : 'purple'}
                  icon={<Scan/>} onClick={() => cycleLayerPickerMode()}/>
      <ToolButton title={t('toggle-bar-position-button-title')} disabled={!selected} selected={selected && selectedTool('xy')} icon={<Move/>} onClick={openTool('xy')}/>
      <ToolButton title={t('toggle-bar-rotation-button-title')} disabled={!selected} selected={selected && selectedTool('rot')} icon={<RotateIcon/>} onClick={openTool('rot')}/>
      <ToolButton title={t('toggle-bar-scale-button-title')} disabled={!selected} selected={selected && selectedTool('scale')} icon={<Scaling/>} onClick={openTool('scale')}/>
      <ToolButton title={t('toggle-bar-skew-button-title')} disabled={!selected} selected={selected && selectedTool('skew')} icon={<TiltIcon/>} onClick={openTool('skew')}/>
      <ToolButton title={t('mirror-group-title')} disabled={!selected} selected={selected && selectedTool('mirror')} icon={<FlipHorizontal2/>} onClick={openTool('mirror')}/>
      <div className="my-[7px] h-px w-[56px] bg-zinc-600"/>
      <ToolButton title={t('main-panel-tab-opacity')} selected={state.editTool === 'opacity'} icon={<TransparentIcon/>} onClick={openTool('opacity')}/>
      <ToolButton title={t('main-panel-tab-layers')} selected={state.editTool === 'layers'} icon={<Layers3/>} onClick={openTool('layers')}/>
      {getLayeringHideGroups(state.item).length > 0
        ? <ToolButton title={t('layering-hide-title')} selected={state.editTool === 'layeringHide'}
                      icon={<GameIcon src="Icons/Private.png"/>} onClick={openTool('layeringHide')}/>
        : null}
      {selected ? <ToolButton title={t('toggle-bar-reset-transforms-button-title')} icon={<RotateCcw/>} onClick={() => resetSelectedTransforms()}/> : null}
    </div>
    <div className="mt-auto flex flex-col gap-[7px]">
      <ToolButton title={state.toolbarLayout === 'neat' ? t('toolbar-mode-neat') : t('toolbar-mode-free')}
                  icon={<SvgIcon src={state.toolbarLayout === 'neat' ? neatIcon : freeIcon}/>} onClick={() => setToolbarLayout(state.toolbarLayout === 'neat' ? 'free' : 'neat')}/>
      {CurrentScreen === 'Appearance' ? <ToolButton title={t('settings-appearance-view-control')} active={state.charControl.open} icon={<SlidersHorizontal/>} onClick={() => toggleCharControlOpen()}/> : null}
      <ToolButton title={t('main-panel-tab-settings')} selected={state.editTool === 'settings'} icon={<SvgIcon src={settingsIcon}/>} onClick={openTool('settings')}/>
    </div>
  </>;
}

function dragLabel(mode: NonNullable<AeeState['activeDrag']>) {
  if (mode === 'xy') return t('toolbar-dragging-position');
  if (mode === 'rot') return t('toolbar-dragging-rotation');
  if (mode === 'scale') return t('toolbar-dragging-scale');
  if (mode === 'mirror') return `${t('mirror-group-mode-title')} / ${t('mirror-group-copy-title')}`;
  return t('toolbar-dragging-skew');
}
