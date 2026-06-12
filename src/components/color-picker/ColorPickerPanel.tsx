import {type PointerEvent as ReactPointerEvent, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {AeeState} from '../../core/types';
import {t} from '../../core/lang';
import {
  closeColorPicker,
  moveColorPicker,
  previewColorPickerValue,
  setColorPickerCollapsed,
  setColorPickerValue
} from '../../controllers/uiController';
import {runtime} from '../../core/runtime';
import {ChevronIcon} from '../icons/ChevronIcon';
import {CopyIcon} from '../icons/CopyIcon';
import {EyedropperIcon} from '../icons/EyedropperIcon';
import {PasteIcon} from '../icons/PasteIcon';
import {clamp, hexToHsv, hsvaString, hsvToHex, hsvToRgb} from './colorMath';
import {ColorSwatchButton} from './ColorSwatchButton';
import {HarmonyRuleButton} from './HarmonyRuleButton';
import {SavedCell} from './SavedCell';
import {ToolButton} from './ToolButton';
import {Track} from './Track';

const BC_HEADING_GAP = 4;
const BC_HEADING_VIEWPORT_MARGIN = 8;
const BC_HGROUP_STYLE_KEYS = [
  'alignItems',
  'bottom',
  'boxSizing',
  'display',
  'height',
  'justifyContent',
  'left',
  'margin',
  'maxWidth',
  'minHeight',
  'overflow',
  'padding',
  'pointerEvents',
  'position',
  'right',
  'textAlign',
  'top',
  'transform',
  'visibility',
  'width',
  'zIndex',
] as const;

type BcHgroupStyleKey = typeof BC_HGROUP_STYLE_KEYS[number];
type BcHgroupStyleSnapshot = Record<BcHgroupStyleKey, string>;

function readInlineStyles(element: HTMLElement) {
  const snapshot = {} as BcHgroupStyleSnapshot;
  BC_HGROUP_STYLE_KEYS.forEach(key => {
    snapshot[key] = element.style[key];
  });
  return snapshot;
}

function restoreInlineStyles(element: HTMLElement, snapshot: BcHgroupStyleSnapshot) {
  BC_HGROUP_STYLE_KEYS.forEach(key => {
    element.style[key] = snapshot[key];
  });
}

function getBcColorPickerHgroup() {
  return (document.getElementById('color-picker-hgroup')
    ?? document.getElementById('color-picker-h1')?.closest('hgroup')
    ?? document.getElementById('color-picker-h1')?.parentElement) as HTMLElement | null;
}

export function ColorPickerPanel({state}: { state: AeeState }) {
  const picker = state.colorPicker;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; sx: number; sy: number; left: number; top: number } | null>(null);
  const svDragRef = useRef<number | null>(null);
  const svThumbRef = useRef<HTMLDivElement>(null);
  const hsvRef = useRef(hexToHsv(picker.hex));
  const pendingHsvRef = useRef<{ h: number; s: number; v: number } | null>(null);
  const latestPreviewHsvRef = useRef<{ h: number; s: number; v: number } | null>(null);
  const hsvFrameRef = useRef<number | null>(null);
  const bcHgroupRestoreRef = useRef<{ element: HTMLElement; styles: BcHgroupStyleSnapshot } | null>(null);
  const [hsv, setHsvState] = useState(() => hsvRef.current);
  const [alpha, setAlpha] = useState(Math.round(picker.opacityPct / 100 * 255));
  const [rule, setRule] = useState('complementary');
  const [saved, setSaved] = useState(() => Array.from({length: 18}, (_, index) => ({
    h: (index * 20) % 360,
    s: 45,
    v: 80,
    a: 255
  })));
  const [selectedSaved, setSelectedSaved] = useState(0);
  const [cardSize, setCardSize] = useState<{ w: number; h: number } | null>(null);
  const previewOnlyRef = useRef(false);
  const lastAppliedColorRef = useRef<{ hex: string; opacityPct: number; preview: boolean } | null>(null);

  const hex = hsvToHex(hsv.h, hsv.s, hsv.v);
  const alphaPct = Math.round(alpha / 255 * 100);
  const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
  const rect = state.canvasRect;
  const defaultLeft = rect ? rect.left + rect.width * 0.66 : window.innerWidth * 0.6;
  const defaultTop = rect ? rect.top + rect.height * 0.2 : window.innerHeight * 0.2;
  const scale = rect ? (rect.width * 0.33) / 500 : 1;
  const top = picker.top ?? defaultTop;
  const toggleW = 24;
  const fw = cardSize?.w ?? 500 * scale;
  const fh = cardSize?.h ?? 0;
  const collapsed = picker.bcMode && picker.collapsed;
  const dockRight = rect?.right ?? window.innerWidth;
  const bcDefaultLeft = Math.max(0, dockRight - fw);
  const left = picker.left ?? (picker.bcMode ? bcDefaultLeft : defaultLeft);

  const setHsv = (next: { h: number; s: number; v: number } | ((current: { h: number; s: number; v: number }) => { h: number; s: number; v: number })) => {
    setHsvState(current => {
      const value = typeof next === 'function' ? next(current) : next;
      hsvRef.current = value;
      return value;
    });
  };

  useEffect(() => () => {
    if (hsvFrameRef.current !== null) cancelAnimationFrame(hsvFrameRef.current);
  }, []);

  useEffect(() => {
    runtime.colorPickerAlpha = alpha;
    if (!picker.open) return;
    if (previewOnlyRef.current) {
      const last = lastAppliedColorRef.current;
      if (last?.hex === hex && last.opacityPct === alphaPct && last.preview) return;
      previewColorPickerValue(hex, alphaPct);
      lastAppliedColorRef.current = {hex, opacityPct: alphaPct, preview: true};
      return;
    }
    if (picker.hex === hex && picker.opacityPct === alphaPct) return;
    setColorPickerValue(hex, alphaPct);
    lastAppliedColorRef.current = {hex, opacityPct: alphaPct, preview: false};
  }, [hex, alphaPct, alpha, picker.open, picker.hex, picker.opacityPct]);

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

  useLayoutEffect(() => {
    if (!picker.bcMode) {
      const restore = bcHgroupRestoreRef.current;
      if (restore) {
        restoreInlineStyles(restore.element, restore.styles);
        bcHgroupRestoreRef.current = null;
      }
      return;
    }

    const hgroup = getBcColorPickerHgroup();
    if (!hgroup) return;

    const restore = bcHgroupRestoreRef.current;
    if (!restore || restore.element !== hgroup) {
      if (restore) restoreInlineStyles(restore.element, restore.styles);
      bcHgroupRestoreRef.current = {element: hgroup, styles: readInlineStyles(hgroup)};
    }

    const maxWidth = Math.max(0, window.innerWidth - BC_HEADING_VIEWPORT_MARGIN * 2);
    const headingWidth = Math.min(maxWidth, fw);
    const minCenter = headingWidth / 2 + BC_HEADING_VIEWPORT_MARGIN;
    const maxCenter = window.innerWidth - headingWidth / 2 - BC_HEADING_VIEWPORT_MARGIN;
    const centerX = minCenter <= maxCenter ? clamp(left + fw / 2, minCenter, maxCenter) : window.innerWidth / 2;

    hgroup.style.alignItems = 'center';
    hgroup.style.boxSizing = 'border-box';
    hgroup.style.display = 'block';
    hgroup.style.height = 'auto';
    hgroup.style.justifyContent = 'center';
    hgroup.style.margin = '0';
    hgroup.style.minHeight = '0';
    hgroup.style.overflow = 'visible';
    hgroup.style.padding = '0';
    hgroup.style.position = 'fixed';
    hgroup.style.left = `${centerX}px`;
    hgroup.style.right = 'auto';
    hgroup.style.bottom = 'auto';
    hgroup.style.width = `${headingWidth}px`;
    hgroup.style.maxWidth = `${maxWidth}px`;
    hgroup.style.transform = 'translate(-50%, -100%)';
    hgroup.style.zIndex = '1000003';
    hgroup.style.pointerEvents = collapsed ? 'none' : 'auto';
    hgroup.style.visibility = collapsed ? 'hidden' : 'visible';
    hgroup.style.textAlign = 'center';

    const hgroupHeight = hgroup.getBoundingClientRect().height || 0;
    hgroup.style.top = `${Math.max(hgroupHeight, top - BC_HEADING_GAP)}px`;
  }, [picker.bcMode, collapsed, left, top, fw]);

  useEffect(() => {
    return () => {
      const restore = bcHgroupRestoreRef.current;
      if (!restore) return;
      restoreInlineStyles(restore.element, restore.styles);
      bcHgroupRestoreRef.current = null;
    };
  }, []);

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
  }, [hsv.h]);

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

  const pickSv = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const s = Math.round(clamp((clientX - r.left) / r.width, 0, 1) * 100);
    const v = Math.round((1 - clamp((clientY - r.top) / r.height, 0, 1)) * 100);
    previewOnlyRef.current = true;
    const thumb = svThumbRef.current;
    if (thumb) {
      thumb.style.left = `${s}%`;
      thumb.style.top = `${100 - v}%`;
    }
    const next = {h: hsvRef.current.h, s, v};
    pendingHsvRef.current = next;
    latestPreviewHsvRef.current = next;
    if (hsvFrameRef.current !== null) return;
    hsvFrameRef.current = requestAnimationFrame(() => {
      hsvFrameRef.current = null;
      const next = pendingHsvRef.current;
      pendingHsvRef.current = null;
      if (next) setHsv(next);
    });
  };

  const flushSvPick = () => {
    if (hsvFrameRef.current !== null) {
      cancelAnimationFrame(hsvFrameRef.current);
      hsvFrameRef.current = null;
    }
    const next = pendingHsvRef.current ?? latestPreviewHsvRef.current;
    pendingHsvRef.current = null;
    latestPreviewHsvRef.current = null;
    if (next) {
      setHsv(next);
      setColorPickerValue(hsvToHex(next.h, next.s, next.v), alphaPct);
    }
    previewOnlyRef.current = false;
  };

  const startSvPick = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    svDragRef.current = event.pointerId;
    pickSv(event.clientX, event.clientY);
  };

  const moveSvPick = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (svDragRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    pickSv(event.clientX, event.clientY);
  };

  const stopSvPick = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (svDragRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    svDragRef.current = null;
    flushSvPick();
  };

  const cancelSvPick = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (svDragRef.current === event.pointerId) {
      svDragRef.current = null;
      flushSvPick();
    }
  };

  const setTrackValue = (label: string, value: number) => {
    if (label === 'H') setHsv(current => ({...current, h: clamp(value, 0, 360)}));
    if (label === 'S') setHsv(current => ({...current, s: clamp(value, 0, 100)}));
    if (label === 'V') setHsv(current => ({...current, v: clamp(value, 0, 100)}));
    if (label === 'A') setAlpha(Math.round(clamp(value, 0, 100) / 100 * 255));
  };

  const cardEl = (
    <div ref={cardRef} style={{zoom: scale}}>
      <div
        className="flex w-125 flex-col gap-2 rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-100 shadow-2xl">
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
        >- {t('colorPickerTitle').toUpperCase()} -
        </div>
        <div className="flex items-start gap-2">
          <div className="flex shrink-0 flex-col gap-1.5 pt-1">
            <ToolButton title="Copy"
                        onClick={() => navigator.clipboard?.writeText(hex + (alpha < 255 ? alpha.toString(16).padStart(2, '0') : ''))}><CopyIcon/></ToolButton>
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
                // The browser reports cancellation as an exception.
              }
            }}><EyedropperIcon/></ToolButton>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1">
            <div
              className="relative h-[100px] w-[100px] overflow-hidden rounded-lg border border-zinc-700 bg-[repeating-conic-gradient(#333_0%_25%,#222_0%_50%)] bg-[length:10px_10px]">
              <span className="absolute inset-0" style={{background: hsvaString(hsv.h, hsv.s, hsv.v, alpha)}}/>
            </div>
            <div className="font-mono text-[11px] text-zinc-400">{hex}</div>
            <div className="flex gap-1">
              <input
                className="w-[74px] rounded border border-zinc-700 bg-transparent px-1 py-0.5 font-mono text-xs text-zinc-100 outline-none focus:border-violet-400"
                value={hex} onChange={event => {
                const value = event.target.value.trim();
                if (/^#[0-9a-fA-F]{6}$/.test(value)) setHsv(hexToHsv(value));
              }}/>
              <input
                className="w-[46px] rounded border border-zinc-700 bg-transparent px-1 py-0.5 font-mono text-xs text-zinc-100 outline-none focus:border-violet-400"
                value={`${alphaPct}%`} onChange={event => {
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
          <div className="relative ml-0.5 h-[140px] w-[260px] shrink-0">
            <canvas
              ref={canvasRef}
              className="block h-full w-full cursor-crosshair select-none touch-none rounded-lg border border-zinc-700 [-webkit-user-drag:none]"
              width={260}
              height={140}
              draggable={false}
              onDragStart={event => event.preventDefault()}
              onPointerDown={startSvPick}
              onPointerMove={moveSvPick}
              onPointerUp={stopSvPick}
              onPointerCancel={cancelSvPick}
              onLostPointerCapture={cancelSvPick}
            />
            <div
              ref={svThumbRef}
              className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent"
              style={{
                left: `${hsv.s}%`,
                top: `${100 - hsv.v}%`,
                border: '3px solid #fff',
                outline: '1px solid rgba(0,0,0,.7)',
                boxShadow: '0 1px 4px rgba(0,0,0,.55)',
              }}
            />
          </div>
        </div>
        <Track label="H" value={hsv.h} max={360} bg="linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)"
               inputValue={Math.round(hsv.h)}
               onPick={(pct, preview) => {
                 previewOnlyRef.current = !!preview;
                 setHsv(current => ({...current, h: Math.round(pct * 360)}));
               }}
               onInput={value => setTrackValue('H', value)}/>
        <Track label="S" value={hsv.s} max={100}
               bg={`linear-gradient(to right,${hsvToHex(hsv.h, 0, hsv.v)},${hsvToHex(hsv.h, 100, hsv.v)})`}
               inputValue={Math.round(hsv.s)}
               onPick={(pct, preview) => {
                 previewOnlyRef.current = !!preview;
                 setHsv(current => ({...current, s: Math.round(pct * 100)}));
               }}
               onInput={value => setTrackValue('S', value)}/>
        <Track label="V" value={hsv.v} max={100}
               bg={`linear-gradient(to right,${hsvToHex(hsv.h, hsv.s, 0)},${hsvToHex(hsv.h, hsv.s, 100)})`}
               inputValue={Math.round(hsv.v)}
               onPick={(pct, preview) => {
                 previewOnlyRef.current = !!preview;
                 setHsv(current => ({...current, v: Math.round(pct * 100)}));
               }}
               onInput={value => setTrackValue('V', value)}/>
        <Track label="A" value={alpha} max={255} bg="repeating-conic-gradient(#444 0% 25%,#222 0% 50%) 0 0/8px 8px"
               overlay={`linear-gradient(to right,transparent,${hex})`} inputValue={`${alphaPct}%`}
               onPick={(pct, preview) => {
                 previewOnlyRef.current = !!preview;
                 setAlpha(Math.round(pct * 255));
               }} onInput={value => setTrackValue('A', value)}/>
        <div className="h-px bg-zinc-800"/>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[11px] uppercase tracking-wide text-zinc-400">{t('harmSec')}</span>
          <div className="flex flex-1 gap-1 overflow-x-auto">
            {['complementary', 'triadic', 'analogous', 'split', 'tetradic'].map(name =>
              <HarmonyRuleButton key={name} name={name} active={rule === name} onClick={() => setRule(name)}/>
            )}
          </div>
        </div>
        <div className="flex h-8 gap-1">
          {harmony.map(([h, s, v]) => {
            const sw = hsvToHex(h, s, v);
            return <ColorSwatchButton key={`${h}-${s}-${v}`} color={sw}
                                      className="group relative flex-1 rounded border border-zinc-700 hover:border-teal-300"
                                      label={sw} onClick={() => setHsv({h, s, v})}/>;
          })}
        </div>
        <div className="flex items-center gap-1">
          <span className="w-12 shrink-0 text-[11px] uppercase tracking-wide text-zinc-400">{t('shadesSec')}</span>
          {shades.map(([h, s, v]) => <ColorSwatchButton key={`${h}-${s}-${v}`} color={hsvToHex(h, s, v)}
                                                        className="h-6 flex-1 rounded border border-zinc-700 hover:border-teal-300"
                                                        onClick={() => setHsv({h, s, v})}/>)}
        </div>
        <div className="h-px bg-zinc-800"/>
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-zinc-400">{t('savedSec')}</span>
          <span className="flex-1"/>
          <button
            className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-100"
            onClick={() => setSaved(items => items.map((item, index) => index === selectedSaved ? {
              ...hsv,
              a: alpha
            } : item))}>{t('colorSave')}</button>
          <button
            className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-100"
            onClick={() => setSaved(items => items.map((item, index) => index === selectedSaved ? {
              h: 0,
              s: 0,
              v: 100,
              a: 255
            } : item))}>{t('colorClear')}</button>
        </div>
        <div className="grid grid-cols-9 gap-1">{saved.slice(0, 9).map((item, index) => <SavedCell key={index}
                                                                                                   item={item}
                                                                                                   selected={selectedSaved === index}
                                                                                                   onClick={() => {
                                                                                                     setSelectedSaved(index);
                                                                                                     setHsv({
                                                                                                       h: item.h,
                                                                                                       s: item.s,
                                                                                                       v: item.v
                                                                                                     });
                                                                                                     setAlpha(item.a);
                                                                                                   }}/>)}</div>
        <div className="grid grid-cols-9 gap-1">{saved.slice(9).map((item, index) => <SavedCell key={index + 9}
                                                                                                item={item}
                                                                                                selected={selectedSaved === index + 9}
                                                                                                onClick={() => {
                                                                                                  setSelectedSaved(index + 9);
                                                                                                  setHsv({
                                                                                                    h: item.h,
                                                                                                    s: item.s,
                                                                                                    v: item.v
                                                                                                  });
                                                                                                  setAlpha(item.a);
                                                                                                }}/>)}</div>
        {!picker.bcMode ? <div className="flex gap-2 border-t border-zinc-800 pt-2">
          <button
            className="flex-1 rounded-lg border border-violet-500 bg-violet-600 px-3 py-2 text-sm font-bold text-white hover:bg-violet-500"
            onClick={() => closeColorPicker(true)}>{t('colorPickerConfirm')}</button>
          <button
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-bold text-zinc-400 hover:text-zinc-100"
            onClick={() => closeColorPicker(false)}>{t('colorPickerCancel')}</button>
        </div> : null}
      </div>
    </div>
  );

  if (!picker.bcMode) {
    return <div className="fixed z-[1000002]" style={{left, top}}>
      <div className="fixed inset-0" onClick={() => closeColorPicker(false)}/>
      <div className="relative">{cardEl}</div>
    </div>;
  }

  return <div
    className="pointer-events-none fixed z-[1000002] overflow-hidden"
    style={{top, left: left - toggleW, width: toggleW + fw, height: fh}}
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
}
