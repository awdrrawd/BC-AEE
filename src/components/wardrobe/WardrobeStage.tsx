import type {ReactNode} from 'react';
import type {CanvasRect} from '@/core/types';
import {CANVAS_HEIGHT, CANVAS_WIDTH} from '@/core/bc';
import {backgroundStyle, isColorBackground} from '@/util/wardrobeBackground';
import {settings, useSetting} from '@/core/settings';
import {useBackdropPreview} from '@/core/dialogs';

export function WardrobeStage({
                                canvasRect,
                                children,
                              }: {
  canvasRect: CanvasRect;
  children: ReactNode;
}) {
  const bgPath = useSetting(settings.wardrobeBgImage);
  const previewing = useBackdropPreview();
  // A solid colour the user chose stays true — only image backgrounds get the readability vignette.
  const dimmed = !previewing && !isColorBackground(bgPath);
  return <div
    className="fixed z-[999998] overflow-hidden"
    style={{left: canvasRect.left, top: canvasRect.top, width: canvasRect.width, height: canvasRect.height}}
  >
    <div
      className="relative flex origin-top-left flex-col select-none text-zinc-100"
      style={{
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        transform: `scale(${canvasRect.width / CANVAS_WIDTH}, ${canvasRect.height / CANVAS_HEIGHT})`,
        ...backgroundStyle(bgPath),
      }}
    >
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${dimmed ? 'bg-black/18' : 'bg-black/0'}`}
        style={{backgroundImage: dimmed ? 'radial-gradient(ellipse at center, rgba(0,0,0,0.15) 35%, rgba(0,0,0,0.55) 100%)' : undefined}}
        aria-hidden="true"
      />
      {children}
    </div>
  </div>;
}
