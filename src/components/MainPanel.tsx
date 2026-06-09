import {useRef, type ReactNode} from 'react';
import type {AeeLayerOverride, AeeState, DragMode, LayerId} from '../core/types';
import {isZh, t} from '../core/lang';
import {
  getAssetBaseXY,
  getLayerColor,
  getLayerDisplayName,
  getLayerOverride,
  getOpacity,
  isGroupLocked,
} from '../core/bc';
import {
  closeOpacityOverlay,
  getPriorityValue,
  movePartsPanel,
  openLayerColorPicker,
  openOpacityOverlay,
  openSelectedLayerColorPicker,
  readOpacityPct,
  resetEditProperty,
  resetPriority,
  resetSelectedTransforms,
  setActiveDrag,
  setEditProperty,
  setOpacity,
  setPriority,
  setScaleLock,
  setSetting,
  setTab,
  stepEditProperty,
  stepOpacity,
  stepPriority,
  toggleCollapse,
  toggleMirror,
  togglePartsOpen,
} from '../controllers/uiController';
import {LayerList} from './LayerRows';
import {
  ChevronIcon,
  ColorIcon,
  LayersIcon,
  LinkIcon,
  MoveIcon,
  OpacityIcon,
  ResetIcon,
  RotateIcon,
  ScaleIcon,
  SkewIcon,
} from './icons/Icons';

const panel = 'z-[999999] flex h-full flex-col overflow-hidden border-r border-zinc-700 bg-zinc-950 text-zinc-100 shadow-2xl';
const iconButton = 'flex h-7 w-7 items-center justify-center rounded border border-transparent text-zinc-400 transition hover:bg-violet-500/15 hover:text-violet-200';
const activeIconButton = 'bg-violet-500/25 text-violet-200 shadow-[inset_-2px_0_0_#8b5cf6]';
const stepButton = 'flex h-6 min-w-0 flex-1 items-center justify-center rounded border border-zinc-700 bg-zinc-800 px-1 text-[11px] text-zinc-100 transition hover:border-violet-500 hover:bg-violet-600 hover:text-white';
const resetButton = 'flex h-6 w-7 shrink-0 items-center justify-center rounded border border-zinc-700 bg-zinc-800 text-xs text-zinc-400 transition hover:border-red-300 hover:bg-red-950/60 hover:text-red-200';
const rangeClass = 'h-1 w-full cursor-pointer appearance-none rounded bg-zinc-800 accent-violet-500';

const tabs = [
  ['edit', 'tabEdit'],
  ['opacity', 'tabOpacity'],
  ['layers', 'tabLayers'],
  ['settings', 'tabSettings'],
] as const;

export function MainPanel({state}: {state: AeeState}) {
  const rect = state.canvasRect;
  if (!rect || !state.visible || !state.item) return null;
  const panelWidth = Math.max(200, Math.min(320, rect.width * 0.27));
  const toggleWidth = 34;

  return <div className="fixed z-[999998] pointer-events-none" style={{left: rect.left, top: rect.top, width: rect.width, height: rect.height}}>
    <div className="pointer-events-none absolute left-0 top-0 h-full overflow-hidden" style={{width: panelWidth + toggleWidth}}>
      <div
        className="flex h-full"
        style={{transform: state.collapsed ? `translateX(-${panelWidth}px)` : 'translateX(0)', transition: 'transform 0.35s ease'}}
      >
        <div className={`${panel} pointer-events-auto`} style={{width: panelWidth}}>
          <div className="flex shrink-0 border-b border-zinc-700">
            {tabs.map(([tab, label]) =>
              <button
                key={tab}
                className={[
                  'h-9 flex-1 border-b-2 text-xs font-bold tracking-wide transition',
                  state.tab === tab ? 'border-violet-500 text-violet-300' : 'border-transparent text-zinc-400 hover:text-zinc-100',
                ].join(' ')}
                onClick={() => setTab(tab)}
              >
                {t(label)}
              </button>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 border-b border-zinc-700 bg-zinc-900 px-2 py-1">
            <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-medium text-zinc-400">AEE v{state.version}</span>
            <button
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition ${state.partsOpen ? 'border-violet-400 bg-violet-500/15 text-violet-200' : 'border-zinc-700 text-zinc-400 hover:border-violet-400 hover:text-violet-200'}`}
              title={t('secPart')}
              onClick={() => togglePartsOpen()}
            >
              <LayersIcon/>
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-0 [scrollbar-width:thin] [scrollbar-color:#8b5cf6_transparent]">
            {state.tab === 'edit' ? <EditTab state={state}/> : null}
            {state.tab === 'opacity' ? <OpacityTab state={state}/> : null}
            {state.tab === 'layers' ? <LayersTab state={state}/> : null}
            {state.tab === 'settings' ? <SettingsTab state={state}/> : null}
          </div>
        </div>
        <div className="flex h-full items-center">
          <ToggleBar state={state}/>
        </div>
      </div>
    </div>
    <PartsFloat state={state}/>
  </div>;
}

function ToggleBar({state}: {state: AeeState}) {
  const makeIcon = (active: boolean, title: string, icon: ReactNode, onClick: () => void) =>
    <button className={`${iconButton} ${active ? activeIconButton : ''}`} title={title} onClick={onClick}>{icon}</button>;

  return <div
    className="pointer-events-auto z-1000000 flex flex-col items-center gap-1 rounded-r-md border border-l-0 border-zinc-700 bg-zinc-950 px-0.5 py-1"
  >
    {state.collapsed ? <div className="flex flex-col items-center gap-1">
      {makeIcon(state.partsOpen, t('secPart'), <LayersIcon/>, () => togglePartsOpen())}
      {makeIcon(state.activeDrag === 'xy', t('coord'), <MoveIcon/>, () => setActiveDrag('xy'))}
      {makeIcon(state.activeDrag === 'rot', t('rotate'), <RotateIcon/>, () => setActiveDrag('rot'))}
      {makeIcon(state.activeDrag === 'scale', t('scale'), <ScaleIcon/>, () => setActiveDrag('scale'))}
      {makeIcon(state.activeDrag === 'skew', t('skew'), <SkewIcon/>, () => setActiveDrag('skew'))}
      {makeIcon(state.colorPicker.open && !state.colorPicker.bcMode, t('colorPickerTitle'), <ColorIcon/>, openSelectedLayerColorPicker)}
      {makeIcon(state.opacityOverlay.open, t('opacity'), <OpacityIcon/>, () => state.opacityOverlay.open ? closeOpacityOverlay() : openOpacityOverlay())}
      {makeIcon(false, 'Reset transforms', <ResetIcon/>, resetSelectedTransforms)}
    </div> : null}
    <button className="flex h-7 w-5 items-center justify-center text-zinc-400 hover:text-violet-300" onClick={toggleCollapse}>
      <ChevronIcon direction={state.collapsed ? 'right' : 'left'} size={12}/>
    </button>
  </div>;
}

function PartsFloat({state}: {state: AeeState}) {
  const drag = useRef<{ox: number; oy: number} | null>(null);
  if (!state.partsOpen || !state.item) return null;
  return <div className="pointer-events-auto absolute z-[1000001] flex max-h-64 min-h-20 w-52 flex-col overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950 shadow-2xl" style={{left: state.partsLeft, top: state.partsTop}}>
    <div
      className="flex cursor-grab items-center justify-between border-b border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400 active:cursor-grabbing"
      onMouseDown={event => {
        const rect = (event.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
        drag.current = {ox: event.clientX - rect.left, oy: event.clientY - rect.top};
        const onMove = (ev: MouseEvent) => {
          if (!drag.current || !state.canvasRect) return;
          const left = Math.max(0, Math.min(ev.clientX - state.canvasRect.left - drag.current.ox, state.canvasRect.width - 210));
          const top = Math.max(0, Math.min(ev.clientY - state.canvasRect.top - drag.current.oy, state.canvasRect.height - 100));
          movePartsPanel(left, top);
        };
        const onUp = () => {
          drag.current = null;
          document.removeEventListener('mousemove', onMove, true);
          document.removeEventListener('mouseup', onUp, true);
        };
        document.addEventListener('mousemove', onMove, true);
        document.addEventListener('mouseup', onUp, true);
      }}
    >
      <span>{t('secPart')}</span>
      <button className="flex h-4 w-4 items-center justify-center rounded text-sm text-zinc-500 hover:bg-red-500/10 hover:text-red-300" onMouseDown={event => event.stopPropagation()} onClick={() => togglePartsOpen(false)}>×</button>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
      <LayerList item={state.item} layers={state.layers} selectedLayer={state.selectedLayer}/>
    </div>
  </div>;
}

function EditTab({state}: {state: AeeState}) {
  return <>
    {state.selectedLayer !== null ? <EditSection state={state} layerId={state.selectedLayer}/> : null}
    <Section title={t('secPart')}>
      <LayerList item={state.item} layers={state.layers} selectedLayer={state.selectedLayer}/>
    </Section>
  </>;
}

function Section({title, children}: {title?: string; children: ReactNode}) {
  return <section className="border-b border-zinc-700 px-2.5 py-2">
    {title ? <div className="mb-1.5 text-center text-xs font-bold uppercase tracking-wider text-zinc-100">{title}</div> : null}
    {children}
  </section>;
}

function EditSection({state, layerId}: {state: AeeState; layerId: LayerId}) {
  const item = state.item;
  const layers = state.layers;
  const layerOverride = getLayerOverride(item, layerId);
  const label = layerId === 'all' ? t('allParts') : getLayerDisplayName(layers[parseInt(layerId, 10)], layerId);
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
      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-bold uppercase tracking-wider text-zinc-100">✦ {label}</span>
      <button className="relative h-6 w-10 shrink-0 overflow-hidden rounded border border-zinc-700 bg-[repeating-conic-gradient(#222_0%_25%,#111_0%_50%)] bg-[length:5px_5px] hover:border-teal-300" onClick={() => openLayerColorPicker(layerId)}>
        <span className="absolute inset-0" style={color ? {background: color} : undefined}/>
      </button>
    </div>
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between text-xs text-zinc-100">
        <span>{t('opacity')}</span>
        <div className="flex items-center gap-1">
          <button className="h-5 rounded border border-zinc-700 px-1.5 text-[11px] hover:border-violet-400 hover:bg-violet-600" onClick={() => stepOpacity(layerId, -1)}>−1</button>
          <span className="min-w-9 text-center font-mono text-xs text-teal-300">{opacity}%</span>
          <button className="h-5 rounded border border-zinc-700 px-1.5 text-[11px] hover:border-violet-400 hover:bg-violet-600" onClick={() => stepOpacity(layerId, 1)}>+1</button>
        </div>
      </div>
      <input type="range" className={rangeClass} min={0} max={100} step={1} value={opacity} onChange={event => setOpacity(layerId, Number(event.target.value))}/>
    </div>
    {locked ? <div className="rounded border border-zinc-800 bg-zinc-900/70 px-2 py-3 text-center text-xs leading-6 text-zinc-400">
      {isZh() ? '此部位已鎖定變形編輯' : 'Transform editing locked'}<br/>
      <span className="text-[10px]">{isZh() ? '仍可編輯透明度與圖層' : 'Opacity & layers still available'}</span>
    </div> : <>
      <PropGroup title={t('coord')} dragMode="xy" dragLabel={t('coordDrag')} activeDrag={state.activeDrag}>
        <PropRow label="X" value={x} ctrl="x" deltas={[-5, -1, 1, 5]}/>
        <PropRow label="Y" value={y} ctrl="y" deltas={[-5, -1, 1, 5]}/>
      </PropGroup>
      <PropGroup title={t('rotate')} dragMode="rot" dragLabel={t('rotateDrag')} activeDrag={state.activeDrag}>
        <PropRow label="°" value={rotation} ctrl="rot" deltas={[-5, -1, 1, 5]}/>
      </PropGroup>
      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-xs font-bold tracking-wide text-zinc-100">{t('scale')}</span>
          <button className={`flex h-6 w-6 rotate-90 items-center justify-center rounded border transition ${state.scaleLock ? 'border-teal-300 bg-teal-400/10 text-teal-300' : 'border-zinc-700 text-zinc-400 hover:border-teal-300 hover:text-teal-300'}`} onClick={() => setScaleLock()}>
            <LinkIcon locked={state.scaleLock}/>
          </button>
          <DragCheck mode="scale" label={t('scaleDrag')} activeDrag={state.activeDrag}/>
        </div>
        <PropRow label="X" value={sx.toFixed(2)} ctrl="sx" deltas={[-0.3, -0.1, 0.1, 0.3]}/>
        <PropRow label="Y" value={sy.toFixed(2)} ctrl="sy" deltas={[-0.3, -0.1, 0.1, 0.3]}/>
      </div>
      <PropGroup title={t('skew')} dragMode="skew" dragLabel={t('coordDrag')} activeDrag={state.activeDrag}>
        <PropRow label="X°" value={(layerOverride.SkewX ?? 0).toFixed(1)} ctrl="skx" deltas={[-5, -1, 1, 5]}/>
        <PropRow label="Y°" value={(layerOverride.SkewY ?? 0).toFixed(1)} ctrl="sky" deltas={[-5, -1, 1, 5]}/>
      </PropGroup>
      <MirrorGroup layerOverride={layerOverride}/>
    </>}
  </Section>;
}

function PropGroup({title, dragMode, dragLabel, activeDrag, children}: {title: string; dragMode: Exclude<DragMode, null>; dragLabel: string; activeDrag: DragMode; children: ReactNode}) {
  return <div className="mb-2">
    <div className="mb-1 flex items-center justify-between gap-2">
      <span className="text-xs font-bold tracking-wide text-zinc-100">{title}</span>
      <DragCheck mode={dragMode} label={dragLabel} activeDrag={activeDrag}/>
    </div>
    {children}
  </div>;
}

function DragCheck({mode, label, activeDrag}: {mode: Exclude<DragMode, null>; label: string; activeDrag: DragMode}) {
  const active = activeDrag === mode;
  return <label className={`flex cursor-pointer items-center gap-1 rounded border px-1.5 py-0.5 text-xs transition ${active ? 'border-teal-300 bg-teal-400/10 text-teal-300' : 'border-zinc-700 text-zinc-400 hover:border-teal-300 hover:text-teal-300'}`}>
    <input className="hidden" type="checkbox" checked={active} onChange={() => setActiveDrag(mode)}/>{label}
  </label>;
}

function PropRow({label, value, ctrl, deltas}: {label: string; value: string | number; ctrl: string; deltas: number[]}) {
  return <div className="mb-1">
    <div className="mb-1 flex items-center justify-between text-xs text-zinc-300">
      <span>{label}</span>
      <input
        type="text"
        className="w-14 border-b border-transparent bg-transparent text-right font-mono text-xs text-teal-300 outline-none focus:border-teal-300 focus:bg-teal-300/10"
        defaultValue={value}
        onBlur={event => setEditProperty(ctrl, Number.parseFloat(event.target.value))}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            setEditProperty(ctrl, Number.parseFloat((event.target as HTMLInputElement).value));
            (event.target as HTMLInputElement).blur();
          }
        }}
        onMouseDown={event => event.stopPropagation()}
        onClick={event => event.stopPropagation()}
      />
    </div>
    <div className="flex gap-0.5">
      {deltas.map(delta => <button key={delta} className={stepButton} onClick={() => stepEditProperty(ctrl, delta)}>{delta > 0 ? '+' : ''}{delta}</button>)}
      <button className={resetButton} onClick={() => resetEditProperty(ctrl)}>↺</button>
    </div>
  </div>;
}

function MirrorGroup({layerOverride}: {layerOverride: AeeLayerOverride & {Opacity: number}}) {
  const mirrorButton = (active: boolean, label: string, onClick: () => void) =>
    <button className={`h-7 flex-1 rounded border text-[11px] font-semibold transition ${active ? 'border-violet-400 bg-violet-950/70 text-violet-200' : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-violet-400'}`} onClick={onClick}>{label}</button>;
  return <div className="mb-2">
    <div className="mb-1 text-xs font-bold tracking-wide text-zinc-100">{t('mirror')}</div>
    <div className="mb-1 grid grid-cols-2 gap-2">
      <div>
        <div className="mb-1 text-center text-[10px] font-bold uppercase tracking-wide text-zinc-500">{isZh() ? '鏡射' : 'Mirror'}</div>
        <div className="flex gap-1">
          {mirrorButton(!!layerOverride.FlipX, t('mirrorH'), () => toggleMirror('FlipX'))}
          {mirrorButton(!!layerOverride.FlipY, t('mirrorV'), () => toggleMirror('FlipY'))}
        </div>
      </div>
      <div>
        <div className="mb-1 text-center text-[10px] font-bold uppercase tracking-wide text-zinc-500">{isZh() ? '複製' : 'Copy'}</div>
        <div className="flex gap-1">
          {mirrorButton(!!layerOverride.MirrorCopy, t('mirrorH'), () => toggleMirror('MirrorCopy'))}
          {mirrorButton(!!layerOverride.MirrorCopyV, t('mirrorV'), () => toggleMirror('MirrorCopyV'))}
        </div>
      </div>
    </div>
    <div className="flex items-center gap-1 text-[11px] text-zinc-400">
      <span>{t('mirrorCenter')}</span>
      <span>H</span>
      <button className="h-5 w-5 rounded border border-zinc-700 bg-zinc-800 hover:bg-violet-600" onClick={() => stepEditProperty('fcx', -0.05)}>-</button>
      <input className="w-9 border-b border-zinc-700 bg-transparent text-center font-mono text-[11px] text-teal-300" defaultValue={(layerOverride.MirrorCopyAxisX ?? 0.5).toFixed(2)} onBlur={event => setEditProperty('fcx', Number(event.target.value))}/>
      <button className="h-5 w-5 rounded border border-zinc-700 bg-zinc-800 hover:bg-violet-600" onClick={() => stepEditProperty('fcx', 0.05)}>+</button>
      <span>V</span>
      <button className="h-5 w-5 rounded border border-zinc-700 bg-zinc-800 hover:bg-violet-600" onClick={() => stepEditProperty('fcy', -0.05)}>-</button>
      <input className="w-9 border-b border-zinc-700 bg-transparent text-center font-mono text-[11px] text-teal-300" defaultValue={(layerOverride.MirrorCopyAxisY ?? 0.5).toFixed(2)} onBlur={event => setEditProperty('fcy', Number(event.target.value))}/>
      <button className="h-5 w-5 rounded border border-zinc-700 bg-zinc-800 hover:bg-violet-600" onClick={() => stepEditProperty('fcy', 0.05)}>+</button>
      <button className="h-5 w-5 rounded border border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-red-300 hover:text-red-200" onClick={() => resetEditProperty('mc')}>↺</button>
    </div>
  </div>;
}

function OpacityTab({state}: {state: AeeState}) {
  const item = state.item;
  const allOpacity = getOpacity(item, 'all');
  const allDisplay = allOpacity === null ? '—' : `${Math.round(allOpacity * 100)}%`;
  const allValue = allOpacity === null ? 100 : Math.round(allOpacity * 100);
  return <>
    <OpacityRow layerId="all" name={t('allParts')} value={allValue} display={allDisplay}/>
    {state.layers.map((layer, index) => {
      const value = readOpacityPct(item, String(index)) ?? 100;
      return <OpacityRow key={`${layer.Name}-${index}`} layerId={String(index)} name={getLayerDisplayName(layer, index)} value={value} display={`${value}%`}/>;
    })}
  </>;
}

function OpacityRow({layerId, name, value, display}: {layerId: LayerId; name: string; value: number; display: string}) {
  return <div className="border-b border-zinc-700 px-2.5 py-2">
    <div className="mb-1 flex items-center justify-between gap-2">
      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-zinc-100">{name}</span>
      <div className="flex items-center gap-1">
        <button className="h-5 rounded border border-zinc-700 px-1.5 text-[11px] hover:border-violet-400 hover:bg-violet-600" onClick={() => stepOpacity(layerId, -1)}>−1</button>
        <span className="min-w-9 text-center font-mono text-xs text-teal-300">{display}</span>
        <button className="h-5 rounded border border-zinc-700 px-1.5 text-[11px] hover:border-violet-400 hover:bg-violet-600" onClick={() => stepOpacity(layerId, 1)}>+1</button>
      </div>
    </div>
    <input type="range" className={rangeClass} min={0} max={100} step={1} value={value} onChange={event => setOpacity(layerId, Number(event.target.value))}/>
  </div>;
}

function LayersTab({state}: {state: AeeState}) {
  if (!state.layers.length) return <div className="p-6 text-center text-sm text-zinc-500">{t('noLayers')}</div>;
  return <>
    <PriorityRow item={state.item} layerId="all" name={<strong>{t('allParts')}</strong>}/>
    {state.layers.map((layer, index) =>
      <PriorityRow key={`${layer.Name}-${index}`} item={state.item} layerId={String(index)} name={getLayerDisplayName(layer, index)}/>
    )}
  </>;
}

function PriorityRow({item, layerId, name}: {item: Item; layerId: LayerId; name: ReactNode}) {
  const priority = getPriorityValue(item, layerId);
  return <div className="border-b border-zinc-700 px-2.5 py-2">
    <div className="mb-1 flex items-center justify-between gap-2">
      <span className={`min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm ${priority.overridden ? 'text-teal-300' : 'text-zinc-100'}`}>
        {name}<span className="ml-1 text-[10px] text-zinc-500">({priority.base})</span>
      </span>
      <div className="flex items-center gap-1">
        <button className="h-5 rounded border border-zinc-700 px-1.5 text-[11px] hover:border-violet-400 hover:bg-violet-600" onClick={() => stepPriority(layerId, -1)}>−1</button>
        <span className="min-w-8 text-center font-mono text-xs text-teal-300">{priority.current}</span>
        <button className="h-5 rounded border border-zinc-700 px-1.5 text-[11px] hover:border-violet-400 hover:bg-violet-600" onClick={() => stepPriority(layerId, 1)}>+1</button>
        <button className="h-5 rounded border border-zinc-700 px-1.5 text-[11px] text-zinc-400 hover:border-red-300 hover:text-red-200" onClick={() => resetPriority(layerId)}>↺</button>
      </div>
    </div>
    <div className="relative flex items-center">
      <input type="range" className={rangeClass} min={-99} max={99} step={1} value={priority.current} onChange={event => setPriority(layerId, Number(event.target.value))}/>
      <span className="pointer-events-none absolute left-1/2 top-1/2 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-violet-500/60"/>
    </div>
  </div>;
}

function SettingsTab({state}: {state: AeeState}) {
  const row = (label: string, key: string, value: boolean) => <div className="flex items-center justify-between border-b border-zinc-800 py-2">
    <span className="text-xs text-zinc-300">{label}</span>
    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-500">
      <input className="accent-violet-500" type="checkbox" checked={value} onChange={event => setSetting(key, event.target.checked)}/>
      <span>{value ? (isZh() ? '啟用' : 'ON') : (isZh() ? '停用' : 'OFF')}</span>
    </label>
  </div>;
  return <>
    <section className="border-b border-zinc-700 px-3 py-2">
      {row(isZh() ? '更衣室視圖控制' : 'Appearance View Control', 'showCharCtrl', state.showCharCtrl)}
      {row(isZh() ? '取代 BC 調色盤' : 'Replace BC color picker', 'useAeeColorPicker', state.useAeeColorPicker)}
      {row(isZh() ? '懸停圖層閃爍（AEE）' : 'Hover layer highlight (AEE)', 'hoverHighlight', state.hoverHighlight)}
      {row(isZh() ? '懸停衣服閃爍（角色身上）' : 'Hover item highlight (character)', 'hoverHighlightChar', state.hoverHighlightChar)}
      {row(isZh() ? '隱藏 LSCG 圖層面板' : 'Hide LSCG layers panel', 'hideLscgLayers', state.hideLscgLayers)}
      {row(isZh() ? '啟用按鈕替換（匯出/匯入）' : 'Enable button replacement (Export/Import)', 'enableAeeMenu', state.enableAeeMenu)}
    </section>
    <div className="p-4 text-left text-xs leading-6 text-zinc-500">
      {isZh() ? <>
        <b className="text-zinc-300">關於 AEE</b><br/>• 不需要 LSCG 也能使用透明度與位移效果<br/>• 旋轉、縮放、傾斜、鏡射為測試功能，不保證長期穩定<br/>• 插件具有高度自定義功能，可能存在少量錯誤<br/>• 如遇問題歡迎回報
      </> : <>
        <b className="text-zinc-300">About AEE</b><br/>• Opacity and offset work without LSCG<br/>• Rotate, scale, skew, and mirror are experimental<br/>• Highly customizable, minor bugs may occur<br/>• Feedback welcome if issues arise
      </>}
    </div>
  </>;
}
