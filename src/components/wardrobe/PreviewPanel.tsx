import {useRef} from 'react';

import {canvasScale} from '@/core/bc';
import {setPan, ZOOM_PCT_MIN} from '@/controllers/wardrobeController';
import {getTargetCharacter, type WardrobeState} from '@/core/wardrobeStore';
import {CharacterCanvas} from '@/components/wardrobe/CharacterCanvas';
import {ZoomControls} from '@/components/wardrobe/ZoomControls';
import {Panel} from '@/components/ui/Panel';
import {settings, useSetting} from '@/core/settings';

type Drag = { pointerId: number; startX: number; startY: number; baseX: number; baseY: number };

export function PreviewPanel({state}: { state: WardrobeState }) {
  const zoomEnabled = useSetting(settings.wardrobeZoom);
  const canPan = zoomEnabled && state.zoomPct > ZOOM_PCT_MIN;
  const drag = useRef<Drag | null>(null);

  return <Panel className="aee-rise-in w-115 shrink-0" style={{animationDelay: '180ms'}}>
    <div
      className={canPan ? 'flex-1 cursor-grab overflow-hidden active:cursor-grabbing' : 'flex-1 overflow-hidden'}
      onPointerDown={event => {
        if (!canPan) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          baseX: state.panX,
          baseY: state.panY,
        };
      }}
      onPointerMove={event => {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const scale = canvasScale(state.canvasRect);
        setPan(
          current.baseX + (event.clientX - current.startX) / scale,
          current.baseY + (event.clientY - current.startY) / scale,
        );
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
    >
      <CharacterCanvas
        character={getTargetCharacter()}
        className="pointer-events-none h-full w-full object-contain"
        style={{transform: `translate(${state.panX}px, ${state.panY}px) scale(${state.zoomPct / 100})`}}
      />
    </div>

    {zoomEnabled ? <ZoomControls zoomPct={state.zoomPct}/> : null}
  </Panel>;
}
