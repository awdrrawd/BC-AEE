import {Maximize, Minus, Plus} from 'lucide-react';
import {t} from '@/i18n/i18n';
import {resetZoom, setZoom, ZOOM_PCT_MAX, ZOOM_PCT_MIN, ZOOM_PCT_STEP} from '@/controllers/wardrobeController';
import {Button} from '@/components/ui/Button';

export function ZoomControls({zoomPct}: { zoomPct: number }) {
  return <div className="flex shrink-0 items-center justify-between gap-2 p-2.5">
    <Button density="stage"
            className="h-10 w-[140px]"
            onClick={resetZoom}
            icon={<Maximize className="h-5 w-5"/>}
    >{t('wardrobe-full-body')}</Button>

    <div className="flex h-10 items-center gap-1">
      <Button density="stage"
              className="h-10 w-10"
              disabled={zoomPct <= ZOOM_PCT_MIN}
              onClick={() => setZoom(zoomPct - ZOOM_PCT_STEP)}
              icon={<Minus className="h-5 w-5"/>}
              aria-label="zoom out"
      />
      <span className="w-[80px] text-center text-[22px] tabular-nums text-[#f0eee4]">{zoomPct}%</span>
      <Button density="stage"
              className="h-10 w-10"
              disabled={zoomPct >= ZOOM_PCT_MAX}
              onClick={() => setZoom(zoomPct + ZOOM_PCT_STEP)}
              icon={<Plus className="h-5 w-5"/>}
              aria-label="zoom in"
      />
    </div>
  </div>;
}
