import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {X} from 'lucide-react';
import {t} from '@/i18n/i18n';
import {clamp} from '@/util/math';
import type {CanvasRect} from '@/core/types';
import {settings, useSetting} from '@/core/settings';
import {
  CUSTOM_FONTS,
  customFontFamily,
  DEFAULT_FONT_ID,
  findCustomFont,
  findSystemFont,
  formatFontSize,
  SYSTEM_FONTS,
} from '@/core/fonts';
import {getFontsVersion, isCustomFontReady, subscribeFonts} from '@/core/fontStore';
import {clearPreloadedFonts, selectItemFont} from '@/controllers/fontController';
import {closeFontPanel, useFontPanelOpen} from '@/core/fontPanel';
import {Panel} from '@/components/ui/Panel';
import {Button, IconButton} from '@/components/ui/Button';
import {showToast} from '@/util/toast';

/** Renders the font popup at App level (once open), outside MainPanel's transformed container. */
export function ItemFontPanelHost({canvasRect}: {canvasRect: CanvasRect | null}) {
  const open = useFontPanelOpen();
  if (!open) return null;
  return <ItemFontPanel canvasRect={canvasRect} onClose={closeFontPanel}/>;
}

/** CSS font-family to render the preview in, or undefined to inherit the panel's default. */
function previewFamily(id: string): string | undefined {
  if (id === DEFAULT_FONT_ID) return undefined;
  const system = findSystemFont(id);
  if (system) return system.family;
  const custom = findCustomFont(id);
  if (custom && isCustomFontReady(id)) return customFontFamily(id);
  return undefined; // not loaded yet — re-renders via the fonts subscription once ready
}

/** Panel size + default position, sized off the BC canvas (like MainPanel) so it isn't oversized. */
function panelGeometry(rect: CanvasRect | null) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = rect ? clamp(rect.width * 0.27, 200, 320) : 300;
  const maxHeight = rect ? clamp(rect.height * 0.85, 240, 600) : Math.min(vh - 16, 560);
  const rawLeft = rect ? rect.left + rect.width * 0.30 : (vw - width) / 2;
  const rawTop = rect ? rect.top + Math.max(0, (rect.height - maxHeight) / 2) : (vh - maxHeight) / 2;
  const left = clamp(rawLeft, 8, Math.max(8, vw - width - 8));
  const top = clamp(rawTop, 8, Math.max(8, vh - maxHeight - 8));
  return {width, maxHeight, left, top};
}

function ItemFontPanel({canvasRect, onClose}: {canvasRect: CanvasRect | null; onClose: () => void}) {
  const selected = useSetting(settings.itemFont) || DEFAULT_FONT_ID;
  // Re-render whenever a font loads or the cache is cleared, so previews/dots stay accurate.
  useSyncExternalStore(subscribeFonts, getFontsVersion);
  const geometry = panelGeometry(canvasRect);
  const [pos, setPos] = useState(() => ({left: geometry.left, top: geometry.top}));
  const [sample, setSample] = useState(() => t('settings-item-font-preview-sample'));
  const [confirmClear, setConfirmClear] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drag = useRef<{pointerId: number; sx: number; sy: number; left: number; top: number} | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => () => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
  }, []);

  const {width, maxHeight} = geometry;
  const family = previewFamily(selected);

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      confirmTimer.current = setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmClear(false);
    void clearPreloadedFonts();
    showToast(t('settings-item-font-cleared'));
  };

  const clampPos = (left: number, top: number) => ({
    left: clamp(left, 8, Math.max(8, window.innerWidth - width - 8)),
    top: clamp(top, 8, Math.max(8, window.innerHeight - 48)),
  });

  const row = (id: string, label: string, size?: number) => {
    const active = id === selected;
    const loaded = size !== undefined && isCustomFontReady(id);
    return <button
      key={id}
      type="button"
      onClick={() => selectItemFont(id)}
      className={[
        'flex w-full items-center justify-between gap-2 rounded-(--aee-panel-radius) border px-2 py-1.5 text-left transition-colors',
        active
          ? 'border-(--aee-accent) bg-(--aee-accent-22) text-(--aee-text-strong)'
          : 'border-transparent text-(--aee-text) hover:bg-(--aee-accent-16)',
      ].join(' ')}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {size !== undefined && <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${loaded ? 'bg-(--aee-accent)' : 'bg-zinc-600'}`}
          title={loaded ? t('settings-item-font-loaded-tooltip') : undefined}
        />}
        <span className="truncate text-[13px]">{label}</span>
      </span>
      {size !== undefined && <span className="shrink-0 font-mono text-[10px] text-zinc-400">{formatFontSize(size)}</span>}
    </button>;
  };

  return <Panel
    className="fixed z-999999 pointer-events-auto"
    style={{left: pos.left, top: pos.top, width, maxHeight}}
  >
    <div
      className="flex shrink-0 cursor-grab items-center justify-between border-b border-zinc-700 bg-zinc-900 px-3 py-2 active:cursor-grabbing"
      onPointerDown={event => {
        if ((event.target as HTMLElement).closest('button')) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {pointerId: event.pointerId, sx: event.clientX, sy: event.clientY, left: pos.left, top: pos.top};
      }}
      onPointerMove={event => {
        if (!drag.current || drag.current.pointerId !== event.pointerId) return;
        setPos(clampPos(
          drag.current.left + event.clientX - drag.current.sx,
          drag.current.top + event.clientY - drag.current.sy,
        ));
      }}
      onPointerUp={event => {
        if (drag.current?.pointerId !== event.pointerId) return;
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
      <span className="text-[13px] font-bold uppercase text-(--aee-accent)">{t('settings-item-font-label')}</span>
      <IconButton icon={<X className="h-3.5 w-3.5"/>} aria-label={t('settings-item-font-label')} onClick={onClose}/>
    </div>

    <div className="flex shrink-0 flex-col gap-1.5 border-b border-zinc-800 p-3">
      <input
        value={sample}
        onChange={event => setSample(event.target.value)}
        placeholder={t('settings-item-font-preview-placeholder')}
        className="h-7 rounded-(--aee-panel-radius) border border-(--aee-accent-55) bg-(--aee-field-bg) px-2 text-xs text-(--aee-text-strong) caret-(--aee-accent) outline-none placeholder:text-white/35 focus:border-(--aee-accent)"
      />
      <div
        className="min-h-14 break-words rounded-(--aee-panel-radius) border border-zinc-800 bg-black/25 px-2 py-1.5 text-[22px] leading-tight text-(--aee-text-strong)"
        style={{fontFamily: family}}
      >
        {sample || <span className="text-zinc-600">{t('settings-item-font-preview')}</span>}
      </div>
    </div>

    <div className="aee-scroll min-h-0 flex-1 overflow-y-auto p-2">
      <div className="flex flex-col gap-0.5">
        {row(DEFAULT_FONT_ID, t('settings-item-font-default'))}
      </div>
      <div className="mt-2 mb-0.5 px-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {t('settings-item-font-system-group')}
      </div>
      <div className="flex flex-col gap-0.5">
        {SYSTEM_FONTS.map(font => row(font.id, font.name))}
      </div>
      {CUSTOM_FONTS.length > 0 && <>
        <div className="mt-2 mb-0.5 px-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          {t('settings-item-font-custom-group')}
        </div>
        <div className="flex flex-col gap-0.5">
          {CUSTOM_FONTS.map(font => row(font.id, font.name, font.size ?? 0))}
        </div>
      </>}
    </div>

    <div className="shrink-0 border-t border-zinc-800 p-2">
      <Button
        tone="danger"
        className="w-full"
        selected={confirmClear}
        onClick={handleClear}
      >{confirmClear ? t('settings-item-font-clear-confirm') : t('settings-item-font-clear-preloaded')}</Button>
    </div>
  </Panel>;
}
