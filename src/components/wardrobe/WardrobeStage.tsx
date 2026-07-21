import type {ReactNode} from 'react';
import type {CanvasRect} from '@/core/types';
import {CANVAS_HEIGHT, CANVAS_WIDTH} from '@/core/bc';
import {PORTRAIT_BASE_WIDTH, useViewport} from '@/core/orientation';
import {backgroundStyle, isColorBackground} from '@/util/wardrobeBackground';
import {settings, useSetting} from '@/core/settings';
import {useBackdropPreview} from '@/core/dialogs';
import {StageContext} from '@/components/wardrobe/stageContext';

export function WardrobeStage({
                                canvasRect,
                                children,
                              }: {
  canvasRect: CanvasRect;
  children: ReactNode;
}) {
  const bgPath = useSetting(settings.wardrobeBgImage);
  const previewing = useBackdropPreview();
  const {width: vw, height: vh, portrait} = useViewport();

  // Landscape: overlay exactly the (always 2:1) BC canvas. Portrait: break free and fill the whole
  // viewport, since the canvas would otherwise be an unusable horizontal strip on a tall screen.
  const rect = portrait
    ? {left: 0, top: 0, width: vw, height: vh}
    : {left: canvasRect.left, top: canvasRect.top, width: canvasRect.width, height: canvasRect.height};

  const virtualWidth = portrait ? PORTRAIT_BASE_WIDTH : CANVAS_WIDTH;
  const virtualHeight = portrait ? Math.round(PORTRAIT_BASE_WIDTH * (vh / Math.max(vw, 1))) : CANVAS_HEIGHT;
  const scaleX = rect.width / virtualWidth;
  const scaleY = rect.height / virtualHeight;

  // A solid colour the user chose stays true — only image backgrounds get the readability vignette.
  const dimmed = !previewing && !isColorBackground(bgPath);
  return <div
    className="fixed z-[999998] overflow-hidden"
    style={{left: rect.left, top: rect.top, width: rect.width, height: rect.height}}
  >
    <div
      className="relative flex origin-top-left flex-col select-none text-zinc-100"
      style={{
        width: virtualWidth,
        height: virtualHeight,
        transform: `scale(${scaleX}, ${scaleY})`,
        ...backgroundStyle(bgPath),
      }}
    >
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${dimmed ? 'bg-black/18' : 'bg-black/0'}`}
        style={{backgroundImage: dimmed ? 'radial-gradient(ellipse at center, rgba(0,0,0,0.15) 35%, rgba(0,0,0,0.55) 100%)' : undefined}}
        aria-hidden="true"
      />
      <StageContext.Provider value={{scale: scaleX, portrait}}>
        {children}
      </StageContext.Provider>
    </div>
  </div>;
}
