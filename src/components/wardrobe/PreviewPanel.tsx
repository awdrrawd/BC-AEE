import {useRef} from 'react';
import {Undo2} from 'lucide-react';
import {t} from '@/i18n/i18n';
import cn from '@/util/cn';

import {revertTryOn, setPan, ZOOM_PCT_MIN} from '@/controllers/wardrobeController';
import {getTargetCharacter, type WardrobeState} from '@/core/wardrobeStore';
import {CharacterCanvas} from '@/components/wardrobe/CharacterCanvas';
import {ZoomControls} from '@/components/wardrobe/ZoomControls';
import {useStage} from '@/components/wardrobe/stageContext';
import {Button} from '@/components/ui/Button';
import {Panel} from '@/components/ui/Panel';
import {settings, useSetting} from '@/core/settings';

type Drag = { pointerId: number; startX: number; startY: number; baseX: number; baseY: number };

export function PreviewPanel({state}: { state: WardrobeState }) {
  const zoomEnabled = useSetting(settings.wardrobeZoom);
  const cancelEnabled = useSetting(settings.wardrobeCancelTryOn);
  const {scale, portrait} = useStage();
  const canPan = zoomEnabled && state.zoomPct > ZOOM_PCT_MIN;
  const drag = useRef<Drag | null>(null);

  return <Panel soft
                className={cn('aee-rise-in relative', portrait ? 'min-w-0 flex-1' : 'w-115 shrink-0')}
                style={{animationDelay: '180ms'}}>
    {cancelEnabled && state.triedOn && state.entryAppearance ? <Button
      density="stage"
      className="absolute left-2 top-2 z-10 h-10 w-10"
      onClick={revertTryOn}
      icon={<Undo2 className="h-5 w-5"/>}
      aria-label={t('wardrobe-revert-tryon')}
      title={t('wardrobe-revert-tryon')}
    /> : null}

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
