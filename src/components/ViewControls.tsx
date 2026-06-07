import {type ReactNode, useRef} from 'react';
import type {AeeState} from '../core/types';
import {isZh, t} from '../core/lang';
import {
  applyPose,
  CTRL_BTN_SIZE,
  CTRL_ICON_FRAME,
  CTRL_ICON_MAIN,
  getPoseIconUrl,
  moveCharControl,
  moveOffsetPanel,
  movePoseWindow,
  POSES,
  resetOffset,
  setCharScale,
  setOffsetX,
  setOffsetY,
  toggleBgSubOpen,
  toggleCharControlOpen,
  toggleExpandDirection,
  toggleGridBg,
  toggleHide,
  toggleHideSubOpen,
  toggleImageBg,
  toggleOffsetCollapsed,
  toggleOffsetPanel,
  togglePoseWindow,
  toggleSolidBg,
  toggleSubDirection,
  toggleWheelControl,
} from '../controllers/viewController';
import {
  defaultBgSettingsPosition,
  moveBgSettings,
  openBgColorPicker,
  openBgSettings,
  setBgEnabled,
  setBgImageEnabled,
  setBgImageUrl,
  setGridEnabled,
  setGridLayer,
  setGridMode,
  setGridOpacity,
  setGridPx,
} from '../controllers/backgroundController';
import {BgIcon, CloseupIcon, FullBodyIcon, HideIcon, OffsetIcon, PoseIcon} from './icons/Icons';

const ctrlButtonBase = 'relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-lg border-0 bg-transparent p-0 pointer-events-auto';
const ctrlLabel = 'pointer-events-none absolute inset-x-0 bottom-0.5 text-center text-[8px] tracking-wide text-white [text-shadow:0_1px_2px_rgba(0,0,0,.9)]';
const panelButton = 'flex h-6 w-6 items-center justify-center rounded border border-zinc-700 bg-transparent text-xs text-zinc-400 transition hover:border-violet-400 hover:text-violet-300';
const smallToggle = 'relative h-[18px] w-[34px] rounded-full bg-zinc-700 transition after:absolute after:left-0.5 after:top-0.5 after:h-3.5 after:w-3.5 after:rounded-full after:bg-white after:transition-all';
const smallToggleOn = 'bg-violet-500 after:left-[18px]';

export function ViewControls({state}: {state: AeeState}) {
  if (!state.charControl.visible || !state.canvasRect) return null;
  return <>
    <CharControl state={state}/>
    <OffsetPanel state={state}/>
    <BgSettingsPanel state={state}/>
    <PoseWindow state={state}/>
  </>;
}

function CharControl({state}: {state: AeeState}) {
  const drag = useRef<{pointerId: number; sx: number; sy: number; left: number; top: number; moved: boolean} | null>(null);
  const left = state.charControl.left ?? state.canvasRect!.width * 0.01;
  const top = state.charControl.top ?? state.canvasRect!.height * 0.87;
  const expandedStyle = state.charControl.expandUp
    ? {left: 0, bottom: CTRL_BTN_SIZE + 8, flexDirection: 'column-reverse' as const}
    : {left: 0, top: CTRL_BTN_SIZE + 8, flexDirection: 'column' as const};
  const subSide = state.charControl.subLeft
    ? {right: CTRL_BTN_SIZE + 6, left: 'auto', flexDirection: 'row-reverse' as const}
    : {left: CTRL_BTN_SIZE + 6, right: 'auto', flexDirection: 'row' as const};

  const ctrlButton = (active: boolean, label: string, icon: ReactNode, onClick: () => void) =>
    <button className={`${ctrlButtonBase} ${active ? '[&_.aee-frame]:brightness-125 [&_.aee-frame]:hue-rotate-160' : ''}`} title={label} onClick={onClick}>
      <span className="aee-frame pointer-events-none absolute inset-0 bg-cover bg-center" style={{backgroundImage: `url(${CTRL_ICON_FRAME})`}}/>
      <span className="pointer-events-none absolute inset-2 flex items-center justify-center [&_svg]:h-7 [&_svg]:w-7">{icon}</span>
      <span className={ctrlLabel}>{label}</span>
    </button>;

  return <div className="fixed z-999995 pointer-events-none overflow-visible" style={{left: state.canvasRect!.left, top: state.canvasRect!.top, width: state.canvasRect!.width, height: state.canvasRect!.height}}>
    <div className="absolute pointer-events-none" style={{left, top, width: CTRL_BTN_SIZE, height: CTRL_BTN_SIZE}}>
      <button
        className="pointer-events-auto absolute inset-0 cursor-grab overflow-hidden rounded-lg border-0 bg-transparent p-0 active:cursor-grabbing active:opacity-85"
        title={t('viewControl')}
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
      <div className={`${state.charControl.open ? 'flex' : 'hidden'} pointer-events-none absolute items-start gap-1.5`} style={expandedStyle}>
        <div className="flex pointer-events-auto">{ctrlButton(state.offset.open || state.offset.x !== 0 || state.offset.y !== 0 || state.offset.scale !== 1, t('offset'), <OffsetIcon/>, () => toggleOffsetPanel())}</div>
        <div className="relative flex pointer-events-auto">
          {ctrlButton(state.charControl.bgSubOpen || state.bg.enabled || state.bg.gridEnabled || state.bg.imageEnabled, t('background'), <BgIcon/>, toggleBgSubOpen)}
          <div className={`${state.charControl.bgSubOpen ? 'flex' : 'hidden'} pointer-events-auto absolute top-0 gap-1`} style={subSide}>
            {subButton(state.bg.enabled, t('solid'), <span className="h-5 w-5 rounded bg-white/80"/>, toggleSolidBg)}
            {subButton(state.bg.gridEnabled, t('grid'), <span className="text-lg text-white">▦</span>, toggleGridBg)}
            {subButton(state.bg.imageEnabled && state.bg.imageLoaded, t('image'), <BgIcon/>, toggleImageBg)}
            {subButton(state.bg.settingsOpen, t('setting'), <span className="text-lg text-white">⚙</span>, () => openBgSettings())}
          </div>
        </div>
        <div className="flex pointer-events-auto">{ctrlButton(state.pose.open, t('pose'), <PoseIcon/>, () => togglePoseWindow())}</div>
        <div className="relative flex pointer-events-auto">
          {ctrlButton(state.hideCloseup || state.hideFullbody, t('hide'), <HideIcon active={state.hideCloseup || state.hideFullbody}/>, toggleHideSubOpen)}
          <div className={`${state.charControl.hideSubOpen ? 'flex' : 'hidden'} pointer-events-auto absolute top-0 gap-1`} style={subSide}>
            {subButton(state.hideFullbody, t('fullbody'), <FullBodyIcon active={state.hideFullbody}/>, () => toggleHide('fullbody'))}
            {subButton(state.hideCloseup, t('closeup'), <CloseupIcon active={state.hideCloseup}/>, () => toggleHide('closeup'))}
          </div>
        </div>
        <div className="flex gap-0.5 pointer-events-auto">
          <button className="flex h-6 w-6 items-center justify-center rounded border border-zinc-700 bg-zinc-950 text-xs text-zinc-400 hover:text-violet-300" onClick={toggleExpandDirection}>{state.charControl.expandUp ? '▲' : '▼'}</button>
          <button className="flex h-6 w-6 items-center justify-center rounded border border-zinc-700 bg-zinc-950 text-xs text-zinc-400 hover:text-violet-300" onClick={toggleSubDirection}>{state.charControl.subLeft ? '◀' : '▶'}</button>
        </div>
      </div>
    </div>
  </div>;
}

function subButton(active: boolean, label: string, icon: ReactNode, onClick: () => void) {
  return <button className={`${ctrlButtonBase} ${active ? '[&_.aee-frame]:brightness-125 [&_.aee-frame]:hue-rotate-160' : ''}`} title={label} onClick={onClick}>
    <span className="aee-frame pointer-events-none absolute inset-0 bg-cover bg-center" style={{backgroundImage: `url(${CTRL_ICON_FRAME})`}}/>
    <span className="pointer-events-none absolute inset-2 flex items-center justify-center [&_svg]:h-7 [&_svg]:w-7">{icon}</span>
    <span className={ctrlLabel}>{label}</span>
  </button>;
}

function OffsetPanel({state}: {state: AeeState}) {
  const drag = useRef<{pointerId: number; sx: number; sy: number; left: number; top: number} | null>(null);
  if (!state.offset.open || !state.canvasRect) return null;
  const left = state.offset.left ?? state.canvasRect.left + state.canvasRect.width * 0.4;
  const top = state.offset.top ?? state.canvasRect.top + state.canvasRect.height * 0.3;
  const mmX = Math.max(2, Math.min(98, ((state.offset.x + 700) / 1500) * 100));
  const mmY = Math.max(2, Math.min(98, ((state.offset.y + 2000) / 4000) * 100));

  const minimapPick = (event: React.MouseEvent<HTMLElement>) => {
    const el = event.currentTarget;
    const pick = (clientX: number, clientY: number) => {
      const r = el.getBoundingClientRect();
      const rx = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      const ry = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
      setOffsetX(Math.round(-700 + rx * 1500));
      setOffsetY(Math.round(-2000 + ry * 4000));
    };
    pick(event.clientX, event.clientY);
    const onMove = (ev: MouseEvent) => pick(ev.clientX, ev.clientY);
    const onUp = () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
    };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
  };

  return <div className="fixed z-[999993] flex w-64 flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-100 shadow-2xl" style={{left, top}}>
    <div
      className="flex cursor-grab items-center justify-between border-b border-zinc-700 bg-zinc-900 px-2.5 py-1.5 active:cursor-grabbing"
      onPointerDown={event => {
        if ((event.target as HTMLElement).closest('button')) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {pointerId: event.pointerId, sx: event.clientX, sy: event.clientY, left, top};
      }}
      onPointerMove={event => {
        if (!drag.current || drag.current.pointerId !== event.pointerId) return;
        moveOffsetPanel(drag.current.left + event.clientX - drag.current.sx, drag.current.top + event.clientY - drag.current.sy);
      }}
      onPointerUp={event => {
        if (!drag.current || drag.current.pointerId !== event.pointerId) return;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        drag.current = null;
      }}
      onPointerCancel={event => {
        if (drag.current?.pointerId === event.pointerId) drag.current = null;
      }}
      onLostPointerCapture={event => {
        if (drag.current?.pointerId === event.pointerId) drag.current = null;
      }}
    >
      <span className="text-[11px] font-bold uppercase tracking-wider text-violet-400">⟳ {isZh() ? '位移控制' : 'Offset'}</span>
      <div className="flex gap-1">
        <button className={panelButton} onClick={toggleOffsetCollapsed}>{state.offset.collapsed ? '▲' : '▼'}</button>
        <button className={panelButton} onClick={() => resetOffset('all')}>↺</button>
        <button className={panelButton} onClick={() => toggleOffsetPanel(false)}>x</button>
      </div>
    </div>
    <div className="bg-zinc-950 px-2.5 pt-2">
      <div className="relative h-28 cursor-crosshair overflow-visible rounded border border-zinc-700 bg-zinc-900" onMouseDown={minimapPick}>
        <span className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-violet-500 transition-[left,top]" style={{left: `${mmX}%`, top: `${mmY}%`}}/>
      </div>
      <div className="mt-1 text-center text-[9px] tracking-wide text-zinc-600">{isZh() ? '點擊/拖移移動人物' : 'Click/drag to move character'}</div>
    </div>
    <div className={`${state.offset.collapsed ? 'hidden' : 'flex'} flex-col gap-2 px-3 py-2.5`}>
      <OffsetSlider label={isZh() ? '左右' : 'X'} min={-700} max={800} step={10} value={state.offset.x} display={(state.offset.x > 0 ? '+' : '') + state.offset.x} onChange={setOffsetX} onReset={() => resetOffset('x')}/>
      <OffsetSlider label={isZh() ? '上下' : 'Y'} min={-2000} max={2000} step={10} value={state.offset.y} display={(state.offset.y > 0 ? '+' : '') + state.offset.y} onChange={setOffsetY} onReset={() => resetOffset('y')}/>
      <OffsetSlider label={isZh() ? '縮放' : 'Scale'} min={20} max={500} step={5} value={Math.round(state.offset.scale * 100)} display={`${Math.round(state.offset.scale * 100)}%`} onChange={(value: number) => setCharScale(value / 100)} onReset={() => resetOffset('scale')}/>
      <div className="h-px bg-zinc-800"/>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-zinc-400">{isZh() ? '滾輪/鍵盤控制' : 'Wheel/Key ctrl'}</span>
        <button className={`${smallToggle} ${state.offset.wheelControl ? smallToggleOn : ''}`} onClick={toggleWheelControl}/>
      </div>
      <div className={`whitespace-pre-line text-[9px] leading-4 text-zinc-600 ${state.offset.wheelControl ? 'block' : 'hidden'}`}>{isZh() ? '滾輪按住/空白鍵=移動\n滾動/Ctrl+±=縮放' : 'Hold wheel/Space=Move\nScroll/Ctrl+±=Scale'}</div>
    </div>
  </div>;
}

function OffsetSlider({label, min, max, step, value, display, onChange, onReset}: {label: string; min: number; max: number; step: number; value: number; display: string; onChange: (value: number) => void; onReset: () => void}) {
  return <div className="flex items-center gap-1.5">
    <span className="w-9 shrink-0 text-[11px] text-zinc-400">{label}</span>
    <input type="range" className="h-1 flex-1 cursor-pointer appearance-none rounded bg-zinc-800 accent-violet-500" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))}/>
    <span className="min-w-9 text-right font-mono text-[11px] text-violet-300">{display}</span>
    <button className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-zinc-700 text-[11px] text-zinc-400 hover:border-red-300 hover:text-red-200" onClick={onReset}>↺</button>
  </div>;
}

function BgSettingsPanel({state}: {state: AeeState}) {
  const drag = useRef<{pointerId: number; sx: number; sy: number; left: number; top: number} | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  if (!state.bg.settingsOpen) return null;
  const fallback = defaultBgSettingsPosition();
  const left = state.bg.panelLeft ?? fallback.left;
  const top = state.bg.panelTop ?? fallback.top;

  return <div className="fixed z-999992 overflow-visible">
    <div className="fixed w-90 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-100 shadow-2xl" style={{left, top}}>
      <div
        className="flex cursor-grab items-center justify-between border-b border-zinc-700 bg-zinc-900 px-3 py-2 active:cursor-grabbing"
        onPointerDown={event => {
          if ((event.target as HTMLElement).closest('button')) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {pointerId: event.pointerId, sx: event.clientX, sy: event.clientY, left, top};
        }}
        onPointerMove={event => {
          if (!drag.current || drag.current.pointerId !== event.pointerId) return;
          moveBgSettings(drag.current.left + event.clientX - drag.current.sx, drag.current.top + event.clientY - drag.current.sy);
        }}
        onPointerUp={event => {
          if (!drag.current || drag.current.pointerId !== event.pointerId) return;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          drag.current = null;
        }}
        onPointerCancel={event => {
          if (drag.current?.pointerId === event.pointerId) drag.current = null;
        }}
        onLostPointerCapture={event => {
          if (drag.current?.pointerId === event.pointerId) drag.current = null;
        }}
      >
        <span className="text-[11px] font-bold uppercase tracking-widest text-violet-400">BG Settings</span>
        <button className={panelButton} onClick={() => openBgSettings(false)}>x</button>
      </div>
      <div className="flex flex-col gap-2.5 p-3">
        <BgSection title={isZh() ? '素色背景' : 'Solid Color'} enabled={state.bg.enabled} onToggle={() => setBgEnabled(!state.bg.enabled)}>
          <div className="flex items-center gap-2">
            <button className="relative h-8 w-8 overflow-hidden rounded border border-zinc-700 bg-[repeating-conic-gradient(#222_0%_25%,#111_0%_50%)] bg-[length:6px_6px]" onClick={() => openBgColorPicker('solid')}><span className="absolute inset-0" style={{background: state.bg.color}}/></button>
            <span className="text-[11px] text-zinc-400">{isZh() ? '點擊選色' : 'Click to pick'}</span>
          </div>
        </BgSection>
        <BgSection title={isZh() ? '格線' : 'Grid' } enabled={state.bg.gridEnabled} onToggle={() => setGridEnabled(!state.bg.gridEnabled)}>
          <div className="flex gap-1">
            <button className={`flex-1 rounded border px-2 py-1 text-[10px] font-semibold ${state.bg.gridMode === 'line' ? 'border-violet-400 bg-violet-500/15 text-violet-300' : 'border-zinc-700 text-zinc-400 hover:text-zinc-100'}`} onClick={() => setGridMode('line')}>Line</button>
            <button className={`flex-1 rounded border px-2 py-1 text-[10px] font-semibold ${state.bg.gridMode === 'checker' ? 'border-violet-400 bg-violet-500/15 text-violet-300' : 'border-zinc-700 text-zinc-400 hover:text-zinc-100'}`} onClick={() => setGridMode('checker')}>Checker</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-14 text-[11px] text-zinc-400">{isZh() ? '顏色' : 'Color'}</span>
            <button className="relative h-7 w-7 overflow-hidden rounded border border-zinc-700 bg-[repeating-conic-gradient(#222_0%_25%,#111_0%_50%)] bg-[length:6px_6px]" onClick={() => openBgColorPicker('grid')}><span className="absolute inset-0" style={{background: state.bg.gridColor}}/></button>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-14 text-[11px] text-zinc-400">Size</span>
            <input type="number" className="w-14 rounded border border-zinc-700 bg-zinc-950 px-1 py-0.5 text-center font-mono text-[11px] text-violet-300 outline-none focus:border-violet-400" min={5} max={200} step={5} value={state.bg.gridPx} onChange={event => setGridPx(Number(event.target.value))}/>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-14 text-[11px] text-zinc-400">{t('opacity')}</span>
            <input type="range" className="h-1 flex-1 appearance-none rounded bg-zinc-800 accent-violet-500" min={5} max={80} step={5} value={Math.round(state.bg.gridOpacity * 100)} onChange={event => setGridOpacity(Number(event.target.value) / 100)}/>
            <span className="w-9 text-right font-mono text-[11px] text-violet-300">{Math.round(state.bg.gridOpacity * 100)}%</span>
          </div>
          <div className="flex gap-1">
            <button className={`flex-1 rounded border px-2 py-1 text-[10px] font-semibold ${state.bg.gridLayer === 'below' ? 'border-teal-300 bg-teal-400/10 text-teal-300' : 'border-zinc-700 text-zinc-400 hover:text-zinc-100'}`} onClick={() => setGridLayer('below')}>{isZh() ? '人物下' : 'Below'}</button>
            <button className={`flex-1 rounded border px-2 py-1 text-[10px] font-semibold ${state.bg.gridLayer === 'above' ? 'border-teal-300 bg-teal-400/10 text-teal-300' : 'border-zinc-700 text-zinc-400 hover:text-zinc-100'}`} onClick={() => setGridLayer('above')}>{isZh() ? '人物上' : 'Above'}</button>
          </div>
        </BgSection>
        <BgSection title={isZh() ? '圖片背景' : 'Image BG'} enabled={state.bg.imageEnabled} onToggle={() => setBgImageEnabled(!state.bg.imageEnabled)}>
          <div className="flex gap-1.5">
            <input ref={urlRef} type="text" className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-100 outline-none focus:border-violet-400" defaultValue={state.bg.imageUrl} placeholder={isZh() ? '圖片網址...' : 'Image URL...'}/>
            <button className="rounded border border-violet-500/40 bg-violet-500/15 px-2 text-[10px] text-violet-300 hover:bg-violet-500/30" onClick={() => setBgImageUrl(urlRef.current?.value.trim() || '')}>{isZh() ? '載入' : 'Load'}</button>
            <button className="rounded border border-red-400/40 bg-red-500/10 px-2 text-[10px] text-red-300 hover:bg-red-500/25" onClick={() => { if (urlRef.current) urlRef.current.value = ''; setBgImageUrl(''); }}>x</button>
          </div>
        </BgSection>
      </div>
    </div>
  </div>;
}

function BgSection({title, enabled, onToggle, children}: {title: string; enabled: boolean; onToggle: () => void; children: ReactNode}) {
  return <section className="overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/80">
    <div className="flex items-center justify-between border-b border-zinc-800 px-2.5 py-1.5">
      <span className="text-xs font-bold tracking-wide text-zinc-100">{title}</span>
      <div className="flex items-center gap-2 text-[11px] text-zinc-400">
        <button className={`${smallToggle} ${enabled ? smallToggleOn : ''}`} onClick={onToggle}/>
        <span>{enabled ? (isZh() ? '啟用' : 'ON') : (isZh() ? '停用' : 'OFF')}</span>
      </div>
    </div>
    <div className="flex flex-col gap-2 px-2.5 py-2">{children}</div>
  </section>;
}

function PoseWindow({state}: {state: AeeState}) {
  const drag = useRef<{pointerId: number; sx: number; sy: number; left: number; top: number} | null>(null);
  if (!state.pose.open || !state.canvasRect) return null;
  const left = state.pose.left ?? Math.round(state.canvasRect.left + state.canvasRect.width * 0.36);
  const top = state.pose.top ?? Math.round(state.canvasRect.top + state.canvasRect.height * 0.08);
  return <div className="fixed z-999990 flex flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-100 shadow-2xl" style={{left, top, width: 4 * (58 + 6) - 6 + 20}}>
    <div
      className="flex cursor-grab items-center justify-between border-b border-zinc-700 bg-zinc-900 px-2.5 py-1.5 active:cursor-grabbing"
      onPointerDown={event => {
        if ((event.target as HTMLElement).closest('button')) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {pointerId: event.pointerId, sx: event.clientX, sy: event.clientY, left, top};
      }}
      onPointerMove={event => {
        if (!drag.current || drag.current.pointerId !== event.pointerId) return;
        movePoseWindow(drag.current.left + event.clientX - drag.current.sx, drag.current.top + event.clientY - drag.current.sy);
      }}
      onPointerUp={event => {
        if (!drag.current || drag.current.pointerId !== event.pointerId) return;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        drag.current = null;
      }}
      onPointerCancel={event => {
        if (drag.current?.pointerId === event.pointerId) drag.current = null;
      }}
      onLostPointerCapture={event => {
        if (drag.current?.pointerId === event.pointerId) drag.current = null;
      }}
    >
      <span className="text-[11px] font-bold uppercase tracking-wider text-violet-400">POSE</span>
      <button className={panelButton} onClick={() => togglePoseWindow(false)}>x</button>
    </div>
    <div className="grid grid-cols-4 gap-1.5 p-2.5">
      {POSES.map((pose, index) => <button key={pose.name} className={`flex h-[58px] w-[58px] flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border p-0.5 transition ${state.pose.activeIndex === index ? 'border-violet-400 bg-violet-500/30' : 'border-white/10 bg-white/5 hover:border-violet-400 hover:bg-violet-500/25'}`} title={isZh() ? pose.zh : pose.en} onClick={() => applyPose(index)}>
        <img className="block h-10.5 w-10.5 object-contain" src={getPoseIconUrl(pose.name)} alt={pose.name} onError={event => { (event.currentTarget as HTMLImageElement).style.display = 'none'; }}/>
        <span className="w-full overflow-hidden text-ellipsis whitespace-nowrap px-0.5 text-center text-[7px] text-zinc-400">{isZh() ? pose.zh : pose.en}</span>
      </button>)}
    </div>
  </div>;
}
