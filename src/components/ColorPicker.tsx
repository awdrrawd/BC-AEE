import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {AeeState} from '../core/types';
import {t} from '../core/lang';
import {closeColorPicker, moveColorPicker, setColorPickerCollapsed, setColorPickerValue} from '../controllers/uiController';
import {runtime} from '../core/runtime';
import {ChevronIcon} from './icons/Icons';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hsvToRgb(h: number, s: number, v: number) {
  s /= 100;
  v /= 100;
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)] as const;
}

function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(value => value.toString(16).padStart(2, '0').toUpperCase()).join('');
}

function hsvToHex(h: number, s: number, v: number) {
  return rgbToHex(...hsvToRgb(h, s, v));
}

function hexToHsv(hex: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return {h: 220, s: 70, v: 90};
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return {h: Math.round(h), s: Math.round(max ? d / max * 100 : 0), v: Math.round(max * 100)};
}

function hsvaString(h: number, s: number, v: number, a: number) {
  const [r, g, b] = hsvToRgb(h, s, v);
  return `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;
}

export function ColorPicker({state}: {state: AeeState}) {
  if (!state.colorPicker.open) return null;
  return <ColorPickerPanel key={state.colorPicker.sessionId} state={state}/>;
}

function ColorPickerPanel({state}: {state: AeeState}) {
  const picker = state.colorPicker;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{pointerId: number; sx: number; sy: number; left: number; top: number} | null>(null);
  const [hsv, setHsv] = useState(() => hexToHsv(picker.hex));
  const [alpha, setAlpha] = useState(Math.round(picker.opacityPct / 100 * 255));
  const [rule, setRule] = useState('complementary');
  const [saved, setSaved] = useState(() => Array.from({length: 18}, (_, index) => ({h: (index * 20) % 360, s: 45, v: 80, a: 255})));
  const [selectedSaved, setSelectedSaved] = useState(0);
  const [cardSize, setCardSize] = useState<{w: number; h: number} | null>(null);

  const hex = hsvToHex(hsv.h, hsv.s, hsv.v);
  const alphaPct = Math.round(alpha / 255 * 100);
  const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
  const rect = state.canvasRect;
  const defaultLeft = rect ? rect.left + rect.width * 0.66 : window.innerWidth * 0.6;
  const defaultTop = rect ? rect.top + rect.height * 0.2 : window.innerHeight * 0.2;
  const scale = rect ? (rect.width * 0.33) / 500 : 1;
  const left = picker.left ?? defaultLeft;
  const top = picker.top ?? defaultTop;

  useEffect(() => {
    runtime.colorPickerAlpha = alpha;
    if (picker.open && (picker.hex !== hex || picker.opacityPct !== alphaPct)) setColorPickerValue(hex, alphaPct);
  }, [hex, alphaPct, alpha, picker.open, picker.hex, picker.opacityPct]);

  // Measure the card's on-screen footprint so the collapse/expand toggle can be
  // anchored relative to it even while the card is visually hidden (collapsed).
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) setCardSize({w: r.width, h: r.height});
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [scale, picker.bcMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const base = hsvToHex(hsv.h, 100, 100);
    const gh = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gh.addColorStop(0, '#fff');
    gh.addColorStop(1, base);
    ctx.fillStyle = gh;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const gv = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gv.addColorStop(0, 'rgba(0,0,0,0)');
    gv.addColorStop(1, '#000');
    ctx.fillStyle = gv;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const px = hsv.s / 100 * canvas.width;
    const py = (1 - hsv.v / 100) * canvas.height;
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [hsv]);

  const harmony = useMemo(() => {
    const h = hsv.h, s = hsv.s, v = hsv.v;
    const map: Record<string, number[][]> = {
      complementary: [[h, s, v], [(h + 180) % 360, s, v]],
      triadic: [[h, s, v], [(h + 120) % 360, s, v], [(h + 240) % 360, s, v]],
      analogous: [[h, s, v], [(h + 30) % 360, s, v], [(h + 330) % 360, s, v], [(h + 60) % 360, s, v]],
      split: [[h, s, v], [(h + 150) % 360, s, v], [(h + 210) % 360, s, v]],
      tetradic: [[h, s, v], [(h + 90) % 360, s, v], [(h + 180) % 360, s, v], [(h + 270) % 360, s, v]],
    };
    return map[rule] || map.complementary;
  }, [hsv, rule]);

  const shades = useMemo(() => [
    [hsv.h, clamp(hsv.s - 35, 0, 100), clamp(hsv.v + 15, 0, 100)],
    [hsv.h, clamp(hsv.s - 15, 0, 100), clamp(hsv.v + 7, 0, 100)],
    [hsv.h, hsv.s, hsv.v],
    [hsv.h, clamp(hsv.s + 12, 0, 100), clamp(hsv.v - 20, 0, 100)],
    [hsv.h, clamp(hsv.s + 22, 0, 100), clamp(hsv.v - 38, 0, 100)],
  ], [hsv]);

  const pickTrack = (event: React.MouseEvent, callback: (pct: number) => void) => {
    const el = event.currentTarget as HTMLElement;
    const pick = (clientX: number) => {
      const r = el.getBoundingClientRect();
      callback(clamp((clientX - r.left) / r.width, 0, 1));
    };
    pick(event.clientX);
    const onMove = (ev: MouseEvent) => pick(ev.clientX);
    const onUp = () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
    };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
  };

  const pickSv = (event: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pick = (clientX: number, clientY: number) => {
      const r = canvas.getBoundingClientRect();
      setHsv(current => ({
        ...current,
        s: Math.round(clamp((clientX - r.left) / r.width, 0, 1) * 100),
        v: Math.round((1 - clamp((clientY - r.top) / r.height, 0, 1)) * 100),
      }));
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

  const toggleW = 24;
  const fw = cardSize?.w ?? 500 * scale;
  const fh = cardSize?.h ?? 0;
  const collapsed = picker.bcMode && picker.collapsed;
  const dockRight = rect?.right ?? window.innerWidth;
  const dockLeft = Math.max(0, dockRight - toggleW - fw);

  const cardEl = (
    <div ref={cardRef} style={{zoom: scale}}>
      <div className="flex w-125 flex-col gap-2 rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-100 shadow-2xl">
          <div
            className="cursor-grab select-none text-[11px] font-bold uppercase tracking-[0.12em] text-violet-400 active:cursor-grabbing"
            onPointerDown={event => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              dragRef.current = {pointerId: event.pointerId, sx: event.clientX, sy: event.clientY, left, top};
            }}
            onPointerMove={event => {
              if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
              moveColorPicker(dragRef.current.left + event.clientX - dragRef.current.sx, dragRef.current.top + event.clientY - dragRef.current.sy);
            }}
            onPointerUp={event => {
              if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
              dragRef.current = null;
            }}
            onPointerCancel={event => {
              if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
            }}
            onLostPointerCapture={event => {
              if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
            }}
          >- {t('colorPickerTitle').toUpperCase()} -</div>
          <div className="flex items-start gap-2">
            <div className="flex shrink-0 flex-col gap-1.5 pt-1">
              <ToolButton title="Copy" onClick={() => navigator.clipboard?.writeText(hex + (alpha < 255 ? alpha.toString(16).padStart(2, '0') : ''))}><CopyIcon/></ToolButton>
              <ToolButton title="Paste" onClick={() => navigator.clipboard?.readText().then(text => {
                const trimmed = text.trim();
                if (/^#[0-9a-fA-F]{6,8}$/.test(trimmed)) {
                  setHsv(hexToHsv(trimmed.slice(0, 7)));
                  if (trimmed.length === 9) setAlpha(parseInt(trimmed.slice(7), 16));
                }
              })}><PasteIcon/></ToolButton>
              <ToolButton title="Eyedropper" onClick={async () => {
                if (!window.EyeDropper) return;
                try {
                  const result = await new window.EyeDropper().open();
                  setHsv(hexToHsv(result.sRGBHex));
                } catch {
                  // unhandle exception
                }
              }}><EyedropperIcon/></ToolButton>
            </div>
            <div className="flex shrink-0 flex-col items-center gap-1">
              <div className="relative h-[100px] w-[100px] overflow-hidden rounded-lg border border-zinc-700 bg-[repeating-conic-gradient(#333_0%_25%,#222_0%_50%)] bg-[length:10px_10px]">
                <span className="absolute inset-0" style={{background: hsvaString(hsv.h, hsv.s, hsv.v, alpha)}}/>
              </div>
              <div className="font-mono text-[11px] text-zinc-400">{hex}</div>
              <div className="flex gap-1">
                <input className="w-[74px] rounded border border-zinc-700 bg-transparent px-1 py-0.5 font-mono text-xs text-zinc-100 outline-none focus:border-violet-400" value={hex} onChange={event => {
                  const value = event.target.value.trim();
                  if (/^#[0-9a-fA-F]{6}$/.test(value)) setHsv(hexToHsv(value));
                }}/>
                <input className="w-[46px] rounded border border-zinc-700 bg-transparent px-1 py-0.5 font-mono text-xs text-zinc-100 outline-none focus:border-violet-400" value={`${alphaPct}%`} onChange={event => {
                  const n = parseInt(event.target.value.replace('%', ''), 10);
                  if (!Number.isNaN(n)) setAlpha(Math.round(clamp(n, 0, 100) / 100 * 255));
                }}/>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                <span>R</span><span className="w-6 font-mono text-zinc-100">{String(rgb[0]).padStart(3, '0')}</span>
                <span>G</span><span className="w-6 font-mono text-zinc-100">{String(rgb[1]).padStart(3, '0')}</span>
                <span>B</span><span className="w-6 font-mono text-zinc-100">{String(rgb[2]).padStart(3, '0')}</span>
              </div>
            </div>
            <canvas ref={canvasRef} className="ml-0.5 shrink-0 cursor-crosshair rounded-lg border border-zinc-700" width={260} height={140} onMouseDown={pickSv}/>
          </div>
          <Track label="H" value={hsv.h} max={360} bg="linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" color={hsvToHex(hsv.h, 100, 100)} onPick={pct => setHsv(current => ({...current, h: Math.round(pct * 360)}))}/>
          <Track label="S" value={hsv.s} max={100} bg={`linear-gradient(to right,${hsvToHex(hsv.h, 0, hsv.v)},${hsvToHex(hsv.h, 100, hsv.v)})`} color={hex} onPick={pct => setHsv(current => ({...current, s: Math.round(pct * 100)}))}/>
          <Track label="V" value={hsv.v} max={100} bg={`linear-gradient(to right,${hsvToHex(hsv.h, hsv.s, 0)},${hsvToHex(hsv.h, hsv.s, 100)})`} color={hex} onPick={pct => setHsv(current => ({...current, v: Math.round(pct * 100)}))}/>
          <Track label="A" value={alpha} max={255} bg="repeating-conic-gradient(#444 0% 25%,#222 0% 50%) 0 0/8px 8px" color={`rgba(${rgb.join(',')},${alpha / 255})`} overlay={`linear-gradient(to right,transparent,${hex})`} onPick={pct => setAlpha(Math.round(pct * 255))}/>
          <div className="h-px bg-zinc-800"/>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[11px] uppercase tracking-wide text-zinc-400">{t('harmSec')}</span>
            <div className="flex flex-1 gap-1 overflow-x-auto">
              {['complementary', 'triadic', 'analogous', 'split', 'tetradic'].map(name =>
                <button key={name} className={`rounded-full border px-2 py-0.5 text-[11px] transition ${rule === name ? 'border-violet-400 bg-violet-500/15 text-violet-300' : 'border-zinc-700 text-zinc-400 hover:text-zinc-100'}`} onClick={() => setRule(name)}>{ruleLabel(name)}</button>
              )}
            </div>
          </div>
          <div className="flex h-8 gap-1">
            {harmony.map(([h, s, v]) => {
              const sw = hsvToHex(h, s, v);
              return <button key={`${h}-${s}-${v}`} className="group relative flex-1 rounded border border-zinc-700 hover:border-teal-300" style={{background: sw}} onClick={() => setHsv({h, s, v})}>
                <span className="absolute inset-x-0 bottom-0 text-center font-mono text-[9px] text-white opacity-0 shadow-black [text-shadow:0_1px_2px_rgba(0,0,0,.8)] group-hover:opacity-100">{sw}</span>
              </button>;
            })}
          </div>
          <div className="flex items-center gap-1">
            <span className="w-12 shrink-0 text-[11px] uppercase tracking-wide text-zinc-400">{t('shadesSec')}</span>
            {shades.map(([h, s, v]) => <button key={`${h}-${s}-${v}`} className="h-6 flex-1 rounded border border-zinc-700 hover:border-teal-300" style={{background: hsvToHex(h, s, v)}} onClick={() => setHsv({h, s, v})}/>)}
          </div>
          <div className="h-px bg-zinc-800"/>
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-zinc-400">{t('savedSec')}</span>
            <span className="flex-1"/>
            <button className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-100" onClick={() => setSaved(items => items.map((item, index) => index === selectedSaved ? {...hsv, a: alpha} : item))}>{t('colorSave')}</button>
            <button className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-100" onClick={() => setSaved(items => items.map((item, index) => index === selectedSaved ? {h: 0, s: 0, v: 100, a: 255} : item))}>{t('colorClear')}</button>
          </div>
          <div className="grid grid-cols-9 gap-1">{saved.slice(0, 9).map((item, index) => <SavedCell key={index} item={item} selected={selectedSaved === index} onClick={() => { setSelectedSaved(index); setHsv({h: item.h, s: item.s, v: item.v}); setAlpha(item.a); }}/>)}</div>
          <div className="grid grid-cols-9 gap-1">{saved.slice(9).map((item, index) => <SavedCell key={index + 9} item={item} selected={selectedSaved === index + 9} onClick={() => { setSelectedSaved(index + 9); setHsv({h: item.h, s: item.s, v: item.v}); setAlpha(item.a); }}/>)}</div>
          {!picker.bcMode ? <div className="flex gap-2 border-t border-zinc-800 pt-2">
            <button className="flex-1 rounded-lg border border-violet-500 bg-violet-600 px-3 py-2 text-sm font-bold text-white hover:bg-violet-500" onClick={() => closeColorPicker(true)}>{t('colorPickerConfirm')}</button>
            <button className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-bold text-zinc-400 hover:text-zinc-100" onClick={() => closeColorPicker(false)}>{t('colorPickerCancel')}</button>
          </div> : null}
      </div>
    </div>
  );

  // Normal (non-BC) mode: free-floating, draggable card with a click-away backdrop.
  if (!picker.bcMode) {
    return <div className="fixed z-[1000002]" style={{left, top}}>
      <div className="fixed inset-0" onClick={() => closeColorPicker(false)}/>
      <div className="relative">{cardEl}</div>
    </div>;
  }

  // BC mode: docked to the right edge of the game canvas. The toggle is a tab glued to the
  // card's left edge; collapsing slides card + tab right together so the card tucks off
  // the canvas edge and only the tab remains, flush against the game border.
  return <div
    className="pointer-events-none fixed z-[1000002] overflow-hidden"
    style={{top, left: dockLeft, width: toggleW + fw, height: fh}}
  >
    <div
      className="flex items-center"
      style={{transform: collapsed ? `translateX(${fw}px)` : 'translateX(0)', transition: 'transform 0.35s ease'}}
    >
      <button
        className="pointer-events-auto flex h-12 w-6 shrink-0 items-center justify-center rounded-l-md border border-r-0 border-zinc-700 bg-zinc-950 text-zinc-400 shadow-lg hover:text-violet-300"
        onClick={() => setColorPickerCollapsed(!picker.collapsed)}
      ><ChevronIcon direction={collapsed ? 'left' : 'right'}/></button>
      <div className={collapsed ? 'pointer-events-none' : 'pointer-events-auto'}>{cardEl}</div>
    </div>
  </div>;

  function Track({label, value, max, bg, color, overlay, onPick}: {label: string; value: number; max: number; bg: string; color: string; overlay?: string; onPick: (pct: number) => void}) {
    return <div className="flex items-center gap-2">
      <span className="w-4 shrink-0 text-right text-[11px] text-zinc-400">{label}</span>
      <div className="relative h-3.5 flex-1 cursor-pointer rounded-full border border-zinc-700" style={{background: bg}} onMouseDown={event => pickTrack(event, onPick)}>
        {overlay ? <div className="absolute inset-0 rounded-full" style={{background: overlay}}/> : null}
        <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{left: `${value / max * 100}%`, background: color}}/>
      </div>
      <input className="w-10 shrink-0 border-b border-zinc-700 bg-transparent px-0.5 text-right font-mono text-[11px] text-zinc-100 outline-none focus:border-violet-400" value={label === 'A' ? `${alphaPct}%` : Math.round(value)} onChange={event => {
        const n = parseInt(event.target.value.replace('%', ''), 10);
        if (Number.isNaN(n)) return;
        if (label === 'H') setHsv(current => ({...current, h: clamp(n, 0, 360)}));
        if (label === 'S') setHsv(current => ({...current, s: clamp(n, 0, 100)}));
        if (label === 'V') setHsv(current => ({...current, v: clamp(n, 0, 100)}));
        if (label === 'A') setAlpha(Math.round(clamp(n, 0, 100) / 100 * 255));
      }}/>
    </div>;
  }
}

function CopyIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="11" height="11" rx="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>;
}

function PasteIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1"/>
  </svg>;
}

function EyedropperIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m2 22 1-1h3l9-9"/>
    <path d="M3 21v-3l9-9"/>
    <path d="m15 6 3.4-3.4a2.1 2.1 0 0 1 3 3L18 9l.4.4a2.1 2.1 0 0 1 0 3 2.1 2.1 0 0 1-3 0l-7.8-7.8a2.1 2.1 0 0 1 0-3 2.1 2.1 0 0 1 3 0L12 3l3 3Z"/>
  </svg>;
}

function ToolButton({title, children, onClick}: {title: string; children: React.ReactNode; onClick: () => void}) {
  return <button className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 text-sm text-zinc-400 hover:border-violet-400 hover:bg-zinc-900 hover:text-violet-300" title={title} onClick={onClick}>{children}</button>;
}

function SavedCell({item, selected, onClick}: {item: {h: number; s: number; v: number; a: number}; selected: boolean; onClick: () => void}) {
  return <button className={`relative aspect-square rounded border bg-[repeating-conic-gradient(#333_0%_25%,#222_0%_50%)] bg-[length:8px_8px] ${selected ? 'border-violet-400' : 'border-zinc-700 hover:border-zinc-500'}`} onClick={onClick}>
    <span className="absolute inset-0 rounded-[3px]" style={{background: hsvaString(item.h, item.s, item.v, item.a)}}/>
  </button>;
}

function ruleLabel(rule: string) {
  if (rule === 'complementary') return t('harmCompl');
  if (rule === 'triadic') return t('harmTriadic');
  if (rule === 'analogous') return t('harmAnalog');
  if (rule === 'split') return t('harmSplit');
  return t('harmTetr');
}
