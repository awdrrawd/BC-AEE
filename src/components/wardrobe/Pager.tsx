import {useLayoutEffect, useRef, useState} from 'react';
import {ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight} from 'lucide-react';
import {isSlotOccupied, pageCount, perPage} from '@/controllers/outfitsController';
import {goToPage} from '@/controllers/wardrobeController';
import type {WardrobeState} from '@/core/wardrobeStore';
import {Button} from '@/components/ui/Button';

const PILL_SIZE = 40;
const PILL_GAP = 6;

export function Pager({state, slots}: { state: WardrobeState; slots: number[] }) {
  const pages = pageCount(slots);
  const size = perPage();
  const current = Math.floor(state.offset / size);

  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => setTrackWidth(track.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  const fits = Math.max(1, Math.floor((trackWidth + PILL_GAP) / (PILL_SIZE + PILL_GAP)));
  const count = Math.min(fits, pages);
  const start = Math.min(Math.max(0, current - Math.floor(count / 2)), Math.max(0, pages - count));
  const visible = Array.from({length: count}, (_, index) => start + index);

  const hasOutfits = (page: number) => slots
    .slice(page * size, page * size + size)
    .some(isSlotOccupied);

  const square = {width: PILL_SIZE, height: PILL_SIZE};

  return <div
    className="aee-rise-in flex h-11 w-full min-w-0 shrink-0 items-center"
    style={{gap: PILL_GAP, animationDelay: '60ms'}}
  >
    <Button density="stage"
            style={square}
            disabled={current === 0}
            onClick={() => goToPage(0, pages)}
            icon={<ChevronsLeft className="h-5 w-5"/>}
            aria-label="first page"
    />
    <Button density="stage"
            style={square}
            disabled={current === 0}
            onClick={() => goToPage(current - 1, pages)}
            icon={<ChevronLeft className="h-5 w-5"/>}
            aria-label="previous page"
    />

    <div
      ref={trackRef}
      className="flex min-w-0 flex-1 items-center justify-center overflow-hidden"
      style={{gap: PILL_GAP}}
    >
      {visible.map(page => <Button density="stage"
                                   key={page}
                                   selected={page === current}
                                   onClick={() => goToPage(page, pages)}
                                   className="relative rounded-full px-0 text-[20px]"
                                   style={square}
      >
        {page + 1}
        {page !== current && hasOutfits(page) ? <span
          className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
          style={{backgroundColor: 'var(--aee-accent)'}}
        /> : null}
      </Button>)}
    </div>

    <Button density="stage"
            style={square}
            disabled={current >= pages - 1}
            onClick={() => goToPage(current + 1, pages)}
            icon={<ChevronRight className="h-5 w-5"/>}
            aria-label="next page"
    />
    <Button density="stage"
            style={square}
            disabled={current >= pages - 1}
            onClick={() => goToPage(pages - 1, pages)}
            icon={<ChevronsRight className="h-5 w-5"/>}
            aria-label="last page"
    />
  </div>;
}
