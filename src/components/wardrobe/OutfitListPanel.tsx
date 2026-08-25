import {Trash2} from '@/components/wardrobe/icons/Icons';
import {type PointerEvent, useEffect, useMemo, useRef, useState} from 'react';
import {t} from '@/i18n/i18n';
import cn from '@/util/cn';

import {
  deleteOutfit,
  filterSlots,
  getOccupiedSlots,
  isSlotOccupied,
  slotName,
  slotTagIcons,
  swapOutfits,
} from '@/controllers/outfitsController';
import {jumpToSlot, setWardrobeSource, startEditingOutfit} from '@/controllers/wardrobeController';
import {askConfirm} from '@/core/prompts';
import type {WardrobeState} from '@/core/wardrobeStore';
import {slotFromPoint} from '@/util/slotDrag';
import {SearchField} from '@/components/wardrobe/SearchField';
import {useStage} from '@/components/wardrobe/stageContext';
import {Button} from '@/components/ui/Button';
import {Panel} from '@/components/ui/Panel';
import {settings, useSetting} from '@/core/settings';

const DRAG_SLOP = 6;
const EDGE_BAND = 40;    // screen px from the list's top/bottom that triggers auto-scroll while dragging
const SCROLL_STEP = 14;  // px per tick
const SCROLL_MS = 30;

export function OutfitListPanel({state}: { state: WardrobeState }) {
  const spsEnabled = useSetting(settings.wardrobeSpsEnabled);
  const slots = useMemo(
    () => getOccupiedSlots(state.sortMode),
    // dataVersion re-reads the occupied slots after any wardrobe change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.dataVersion, state.sortMode],
  );
  const canDelete = state.selection >= 0 && isSlotOccupied(state.selection);
  const reorder = state.reorderMode;
  const {scale} = useStage();

  // --- Drag-to-reorder (only while reorder mode is on) — mirrors the grid, scrolling at the edges. ---
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const start = useRef<{x: number; y: number} | null>(null);
  const sourceSlot = useRef(-1);
  const active = useRef(false);
  const justDragged = useRef(false);
  const edgeTimer = useRef<number | null>(null);
  const edgeDir = useRef(0);
  const [dropTarget, setDropTarget] = useState(-1);

  const clearEdge = () => {
    if (edgeTimer.current != null) clearInterval(edgeTimer.current);
    edgeTimer.current = null;
    edgeDir.current = 0;
  };
  const reset = () => {
    if (ghostRef.current) ghostRef.current.style.display = 'none';
    start.current = null;
    sourceSlot.current = -1;
    active.current = false;
    clearEdge();
    setDropTarget(-1);
  };

  // Reset a drag if the grid unmounts or reorder mode is switched off mid-drag.
  useEffect(() => {
    if (!reorder) reset();
    return () => {
      if (edgeTimer.current != null) clearInterval(edgeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reorder]);

  const moveGhost = (x: number, y: number) => {
    const ghost = ghostRef.current;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!ghost || !rect) return;
    ghost.style.transform = `translate(${(x - rect.left) / (scale || 1) + 14}px, ${(y - rect.top) / (scale || 1) + 14}px)`;
  };
  const slotAt = (x: number, y: number) =>
    slotFromPoint(scrollRef.current?.getRootNode() as Document | ShadowRoot, x, y);

  const onPointerDown = (event: PointerEvent) => {
    if (!reorder || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const row = (event.target as HTMLElement).closest('[data-slot]');
    const slot = row ? Number(row.getAttribute('data-slot')) : -1;
    if (slot < 0) return;
    start.current = {x: event.clientX, y: event.clientY};
    sourceSlot.current = slot;
    active.current = false;
  };

  const onPointerMove = (event: PointerEvent) => {
    const from = start.current;
    if (!from) return;
    if (!active.current) {
      if (Math.hypot(event.clientX - from.x, event.clientY - from.y) < DRAG_SLOP) return;
      active.current = true;
      justDragged.current = true; // suppress the tap (jumpToSlot) that would otherwise follow
      scrollRef.current?.setPointerCapture(event.pointerId);
      const ghost = ghostRef.current;
      if (ghost) {
        ghost.textContent = `#${sourceSlot.current + 1} ${slotName(sourceSlot.current)}`.trim();
        ghost.style.display = 'block';
      }
    }
    moveGhost(event.clientX, event.clientY);
    const target = slotAt(event.clientX, event.clientY);
    setDropTarget(target !== sourceSlot.current ? target : -1);

    // Dwell near an edge → scroll the list that way to reach off-screen rows.
    const rect = scrollRef.current?.getBoundingClientRect();
    const dir = !rect ? 0
      : event.clientY < rect.top + EDGE_BAND ? -1
        : event.clientY > rect.bottom - EDGE_BAND ? 1 : 0;
    if (dir !== edgeDir.current) {
      clearEdge();
      if (dir !== 0) {
        edgeDir.current = dir;
        edgeTimer.current = window.setInterval(() => scrollRef.current?.scrollBy(0, dir * SCROLL_STEP), SCROLL_MS);
      }
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!start.current) return;
    const source = sourceSlot.current;
    const target = active.current ? slotAt(event.clientX, event.clientY) : -1;
    if (scrollRef.current?.hasPointerCapture(event.pointerId)) scrollRef.current.releasePointerCapture(event.pointerId);
    reset();
    if (target >= 0 && target !== source) swapOutfits(source, target);
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (scrollRef.current?.hasPointerCapture(event.pointerId)) scrollRef.current.releasePointerCapture(event.pointerId);
    reset();
  };

  const remove = async () => {
    if (await askConfirm(t('wardrobe-confirm-delete'), true)) deleteOutfit(state.selection);
  };

  return <Panel ref={panelRef} soft className="aee-rise-in relative w-80 shrink-0 gap-2.5 p-2.5">
    <SearchField value={state.search}/>

    <div
      ref={scrollRef}
      className="aee-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto rounded-xl bg-black/20 p-1.5"
      style={reorder ? {touchAction: 'none', cursor: 'grab'} : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClickCapture={event => {
        if (!justDragged.current) return;
        justDragged.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {slots.length === 0
        ? <p className="mt-4 text-center text-[22px] text-zinc-500">{t('wardrobe-no-saved-outfits')}</p>
        : slots.map(slot => {
          const icons = slotTagIcons(slot.index);
          return <Button density="stage"
                         key={slot.index}
                         data-slot={slot.index}
                         selected={state.selection === slot.index}
                         onClick={() => jumpToSlot(slot.index, filterSlots('', null, state.sortMode).indexOf(slot.index))}
                         onDoubleClick={() => startEditingOutfit(slot.index)}
                         className={cn('h-8.5 shrink-0 justify-start text-left',
                           reorder && dropTarget === slot.index && 'ring-2 ring-(--aee-accent)')}
          >
            <span className="inline-block shrink-0 text-right tabular-nums text-white/50" style={{minWidth: '3ch'}}>
              {slot.index + 1}
            </span>
            <span className="ml-2 truncate">{slot.name}</span>
            {icons.length ? <span className="ml-auto shrink-0 pl-1">{icons.join('')}</span> : null}
          </Button>;
        })}
    </div>

    <Button density="stage"
            className="h-9.5 shrink-0"
            disabled={!canDelete}
            onClick={() => void remove()}
            icon={<Trash2 className="h-5 w-5"/>}
    >{t('wardrobe-delete-outfit')}</Button>

    <div className="flex h-12.5 shrink-0 gap-2.5">
      <Button density="stage"
              className="flex-1"
              selected={state.source === 'online'}
              onClick={() => setWardrobeSource('online')}
      >{t('wardrobe-source-online-short')}</Button>
      <Button density="stage"
              className="flex-1"
              selected={state.source === 'local'}
              onClick={() => setWardrobeSource('local')}
      >{t('wardrobe-source-local-short')}</Button>
      {spsEnabled ? <Button density="stage"
              className="flex-1"
              selected={state.source === 'sps'}
              onClick={() => setWardrobeSource('sps')}
      >SPS</Button> : null}
    </div>

    <div
      ref={ghostRef}
      className="pointer-events-none absolute left-0 top-0 z-40 hidden max-w-64 truncate rounded-lg border-2 border-dashed border-(--aee-accent) bg-black/80 px-3 py-1.5 text-[20px] text-(--aee-text-strong) shadow-lg"
    />
  </Panel>;
}
