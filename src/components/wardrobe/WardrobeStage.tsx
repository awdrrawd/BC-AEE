import type {ReactNode} from 'react';
import type {CanvasRect} from '@/core/types';
import {CANVAS_HEIGHT, CANVAS_WIDTH} from '@/core/bc';
import {backgroundStyle} from '@/util/wardrobeBackground';

export function WardrobeStage({
                                canvasRect,
                                children,
                              }: {
  canvasRect: CanvasRect;
  children: ReactNode;
}) {
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
        ...backgroundStyle(),
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-black/18"
        style={{backgroundImage: 'radial-gradient(ellipse at center, rgba(0,0,0,0.15) 35%, rgba(0,0,0,0.55) 100%)'}}
        aria-hidden="true"
      />
      {children}
    </div>
  </div>;
}
