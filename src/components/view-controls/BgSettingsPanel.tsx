import {useRef} from 'react';
import type {AeeState} from '../../core/types';
import {isZh, t} from '../../core/lang';
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
} from '../../controllers/backgroundController';
import {BgLayerButton} from './BgLayerButton';
import {BgModeButton} from './BgModeButton';
import {BgSection} from './BgSection';
import {ColorChipButton} from './ColorChipButton';
import {PanelIconButton} from './PanelIconButton';

export function BgSettingsPanel({state}: {state: AeeState}) {
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
        <PanelIconButton onClick={() => openBgSettings(false)}>x</PanelIconButton>
      </div>
      <div className="flex flex-col gap-2.5 p-3">
        <BgSection title={isZh() ? '素色背景' : 'Solid Color'} enabled={state.bg.enabled} onChange={setBgEnabled}>
          <div className="flex items-center gap-2">
            <ColorChipButton color={state.bg.color} size="md" onClick={() => openBgColorPicker('solid')}/>
            <span className="text-[11px] text-zinc-400">{isZh() ? '點擊選色' : 'Click to pick'}</span>
          </div>
        </BgSection>
        <BgSection title={isZh() ? '格線' : 'Grid'} enabled={state.bg.gridEnabled} onChange={setGridEnabled}>
          <div className="flex gap-1">
            <BgModeButton active={state.bg.gridMode === 'line'} label="Line" onClick={() => setGridMode('line')}/>
            <BgModeButton active={state.bg.gridMode === 'checker'} label="Checker" onClick={() => setGridMode('checker')}/>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-14 text-[11px] text-zinc-400">{isZh() ? '顏色' : 'Color'}</span>
            <ColorChipButton color={state.bg.gridColor} size="sm" onClick={() => openBgColorPicker('grid')}/>
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
            <BgLayerButton active={state.bg.gridLayer === 'below'} label={isZh() ? '人物下' : 'Below'} onClick={() => setGridLayer('below')}/>
            <BgLayerButton active={state.bg.gridLayer === 'above'} label={isZh() ? '人物上' : 'Above'} onClick={() => setGridLayer('above')}/>
          </div>
        </BgSection>
        <BgSection title={isZh() ? '圖片背景' : 'Image BG'} enabled={state.bg.imageEnabled} onChange={setBgImageEnabled}>
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
