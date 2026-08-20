import {useCallback, useEffect, useMemo, useState, type SyntheticEvent} from 'react';
import {t} from '@/i18n/i18n';
import {askConfirm, askText} from '@/core/prompts';
import {showToast} from '@/util/toast';
import {A, invalidateSlot, pushUndo} from '@/components/mask-system/freeDraw/slots';
import {afterEdit} from '@/components/mask-system/freeDraw/editing';
import {State} from '@/components/mask-system/freeDraw/editorState';
import {
  clearLibrarySlot, ensureLibraryPage, type LibraryEntry, peekLibraryPage,
  recallLibrarySlot, saveLibrarySlot,
} from '@/components/mask-system/freeDraw/library';
import {
  APPEARANCE_UPLOAD_BYTES, APPEARANCE_WARN_BYTES, canvasEmbeddedData,
  formatBytesK, projectedAppearanceBytes,
} from '@/components/mask-system/freeDraw/appearanceSize';
import {BOARD_H, BOARD_W} from '@/components/mask-system/constants';

function canvasRect(): DOMRect | null {
  return (document.getElementById('MainCanvas') as HTMLCanvasElement | null)?.getBoundingClientRect() ?? null;
}

function LibraryThumbnail({entry}: {entry: LibraryEntry}) {
  const url = useMemo(() => entry.data.length
    ? URL.createObjectURL(new Blob([entry.data], {type: entry.mime || 'image/png'})) : '', [entry]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return <div className="flex h-16 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-[var(--aee-border)] bg-black/50">
    {url ? <img src={url} className="h-full w-full object-contain"/> : <span className="text-xl text-white/25">＋</span>}
  </div>;
}

export function FreeDrawLibraryPanel() {
  const activeSlot = A;
  const [, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  const [usage, setUsage] = useState(0);

  const libraryError = useCallback((error: unknown) => {
    console.warn('🐈‍⬛ [AEE] Free-draw library operation failed', error);
    showToast(t(error instanceof Error && error.message === 'freedraw_library_image_too_large'
      ? 'free-draw-library-too-large' : 'free-draw-library-failed'), {color: '#f87171', duration: 5000});
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick(value => value + 1);
      if (!A) return;
      try { setUsage(projectedAppearanceBytes(canvasEmbeddedData(A.canvas))); }
      catch { setUsage(0); }
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!activeSlot) return;
    void Promise.all(Array.from({length: 6}, (_, page) => ensureLibraryPage(page)))
      .then(() => setTick(value => value + 1)).catch(libraryError);
  }, [activeSlot, libraryError]);

  const recall = async (index: number) => {
    if (!A || busy) return;
    setBusy(true);
    try {
      const blob = await recallLibrarySlot(index);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      try {
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
          const value = new Image(); value.onload = () => resolve(value); value.onerror = reject; value.src = url;
        });
        pushUndo();
        A.ctx.clearRect(0, 0, BOARD_W, BOARD_H);
        A.ctx.drawImage(image, 0, 0, BOARD_W, BOARD_H);
        invalidateSlot(A);
        afterEdit();
      } finally { URL.revokeObjectURL(url); }
    } catch (error) { libraryError(error); }
    finally { setBusy(false); }
  };

  const save = async (index: number, currentName: string) => {
    if (!A || busy) return;
    const name = await askText(t('free-draw-library-name-prompt'), currentName || t('free-draw-library-default-name', {slot: index + 1}));
    if (name === null || !A) return;
    setBusy(true);
    try {
      await saveLibrarySlot(index, name, A.canvas);
      showToast(t('free-draw-library-saved'));
      setTick(value => value + 1);
    } catch (error) { libraryError(error); }
    finally { setBusy(false); }
  };

  const clear = async (index: number) => {
    if (busy || !await askConfirm(t('free-draw-library-clear-confirm'), true)) return;
    setBusy(true);
    try {
      await clearLibrarySlot(index);
      showToast(t('free-draw-library-cleared'));
      setTick(value => value + 1);
    } catch (error) { libraryError(error); }
    finally { setBusy(false); }
  };

  const rect = canvasRect();
  if (!A || !rect) return null;
  const scaleX = rect.width / 2000;
  const scaleY = rect.height / 1000;
  const pages = Array.from({length: 6}, (_, page) => peekLibraryPage(page));
  const entries = pages.every((value): value is LibraryEntry[] => value !== null) ? pages.flat() : null;
  const accent = usage >= APPEARANCE_UPLOAD_BYTES ? '#ef4444' : usage >= APPEARANCE_WARN_BYTES ? '#facc15' : '#22c55e';
  const pct = Math.min(100, usage / APPEARANCE_UPLOAD_BYTES * 100);
  const stop = (event: SyntheticEvent) => event.stopPropagation();

  return <section className="fixed z-1000001 flex h-[1000px] w-[430px] flex-col overflow-hidden border-r-2 border-[var(--aee-accent)] bg-[#100d18]/96 text-lg text-white shadow-2xl backdrop-blur"
             style={{left: rect.left, top: rect.top, transform: `scale(${scaleX}, ${scaleY})`, transformOrigin: 'top left'}}
             onPointerDown={stop} onClick={stop}>
      <header className="flex h-16 shrink-0 items-center justify-center bg-[#1b1627] px-5 text-[22px] font-bold">
        {t('free-draw-library-title')}
      </header>
      <div className="grid shrink-0 grid-cols-[1fr_110px] gap-3 border-y border-white/10 p-4">
        <button className={`h-11 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg border px-3 text-lg font-bold transition ${State.useSps ? 'border-green-400 bg-green-900/55 text-green-100' : 'border-[var(--aee-border)] bg-white/5'}`}
                title={t('free-draw-mode-tooltip')} onClick={() => { State.useSps = !State.useSps; setTick(value => value + 1); }}>
          {State.useSps ? t('free-draw-mode-sps') : t('free-draw-mode-embedded')}
        </button>
        <button className={`h-11 rounded-lg border px-3 text-lg font-bold transition ${deleteMode ? 'border-red-400 bg-red-900/60 text-red-100' : 'border-red-500/60 bg-white/5 text-red-200'}`}
                onClick={() => setDeleteMode(value => !value)}>{t('wardrobe-panel-delete')}</button>
      </div>

      <div className="aee-scroll min-h-0 flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-2">
          {!entries ? <div className="py-12 text-center text-white/70">{t('free-draw-library-loading')}</div> : entries.map((entry, local) => {
            const index = local;
            return <article key={index} className="grid grid-cols-[64px_1fr] items-center gap-3 rounded-lg border border-white/15 bg-white/5 p-3 hover:border-[var(--aee-accent)]">
              <LibraryThumbnail entry={entry}/>
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-semibold">{index + 1}. {entry.name || (entry.data.length ? t('free-draw-library-unnamed') : t('free-draw-library-empty'))}</div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="min-w-0 flex-1 text-sm text-white/60">{entry.data.length ? `${Math.ceil(entry.data.length / 1000)}K` : '—'}</span>
                  <button disabled={!entry.data.length || busy} className="h-9 rounded border border-[var(--aee-border)] px-3 text-lg disabled:opacity-30" onClick={() => void recall(index)}>{t('free-draw-library-recall')}</button>
                  {deleteMode
                    ? <button disabled={!entry.data.length || busy} className="h-9 rounded border border-red-500/70 px-3 text-lg text-red-200 disabled:opacity-30" onClick={() => void clear(index)}>{t('wardrobe-panel-delete')}</button>
                    : <button disabled={busy} className="h-9 rounded border border-[var(--aee-accent)] px-3 text-lg" onClick={() => void save(index, entry.name)}>{t('free-draw-library-save')}</button>}
                </div>
              </div>
            </article>;
          })}
        </div>
      </div>

      <footer className="pointer-events-none shrink-0 border-t-2 bg-[#17131f] px-4 py-4" style={{borderColor: accent}}>
      <div className="mb-2 flex items-center justify-between text-lg font-bold">
        <span>{t('free-draw-size-title')}</span><span style={{color: accent}}>{formatBytesK(usage)} / 160K</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-black/60"><div className="h-full rounded-full transition-[width] duration-300" style={{width: `${pct}%`, backgroundColor: accent}}/></div>
      </footer>
    </section>;
}
