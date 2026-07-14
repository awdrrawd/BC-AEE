import {type PointerEvent as ReactPointerEvent, useEffect, useRef, useState} from 'react';
import {getCanvas} from '@/core/bc';
import {rgbToHex} from '@/components/color-picker/colorMath';

const SAMPLE = 15;
const LOUPE_PX = 168;
const LOUPE_OFFSET = 22;

interface HoverInfo {
  hex: string;
  textColor: string;
  clientX: number;
  clientY: number;
}

export function EyedropperOverlay({onPick, onCancel}: { onPick: (hex: string) => void; onCancel: () => void }) {
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);

  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  const drawLoupe = (region: ImageData) => {
    const loupe = loupeRef.current;
    const lctx = loupe?.getContext('2d');
    if (!loupe || !lctx) return;
    const n = region.width;
    const cell = loupe.width / n;

    const scratch = document.createElement('canvas');
    scratch.width = n;
    scratch.height = n;
    scratch.getContext('2d')?.putImageData(region, 0, 0);
    lctx.imageSmoothingEnabled = false;
    lctx.clearRect(0, 0, loupe.width, loupe.height);
    lctx.drawImage(scratch, 0, 0, n, n, 0, 0, loupe.width, loupe.height);

    lctx.lineWidth = 1;
    lctx.strokeStyle = 'rgba(0,0,0,0.28)';
    lctx.beginPath();
    for (let i = 1; i < n; i++) {
      const p = Math.round(i * cell) + 0.5;
      lctx.moveTo(p, 0);
      lctx.lineTo(p, loupe.height);
      lctx.moveTo(0, p);
      lctx.lineTo(loupe.width, p);
    }
    lctx.stroke();

    const c = Math.floor(n / 2);
    lctx.strokeStyle = '#000';
    lctx.lineWidth = 2;
    lctx.strokeRect(c * cell + 1, c * cell + 1, cell - 2, cell - 2);
    lctx.strokeStyle = '#fff';
    lctx.lineWidth = 1;
    lctx.strokeRect(c * cell + 0.5, c * cell + 0.5, cell - 1, cell - 1);
  };

  const readAt = (clientX: number, clientY: number) => {
    const canvas = getCanvas();
    let ctx: CanvasRenderingContext2D | null;
    try {
      ctx = canvas?.getContext('2d') ?? null;
    } catch {
      ctx = null;
    }
    if (!canvas || !ctx) return setHover(null);
    const rect = canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return setHover(null);

    const px = Math.floor((clientX - rect.left) * (canvas.width / rect.width));
    const py = Math.floor((clientY - rect.top) * (canvas.height / rect.height));
    const half = (SAMPLE - 1) / 2;
    let region: ImageData;
    try {
      region = ctx.getImageData(px - half, py - half, SAMPLE, SAMPLE);
    } catch {
      return setHover(null);
    }
    const center = (half * region.width + half) * 4;
    const r = region.data[center], g = region.data[center + 1], b = region.data[center + 2];
    drawLoupe(region);
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    setHover({hex: rgbToHex(r, g, b), textColor: luminance > 140 ? '#000' : '#fff', clientX, clientY});
  };

  const isInsideCanvas = (clientX: number, clientY: number) => {
    const rect = getCanvas()?.getBoundingClientRect();
    return !!rect && clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onCancelRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const commit = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (hover && isInsideCanvas(event.clientX, event.clientY)) onPick(hover.hex);
    else onCancel();
  };

  const loupeContentH = LOUPE_PX + 56;
  let loupeLeft = (hover?.clientX ?? 0) + LOUPE_OFFSET;
  let loupeTop = (hover?.clientY ?? 0) + LOUPE_OFFSET;
  if (loupeLeft + LOUPE_PX + 12 > window.innerWidth) loupeLeft = (hover?.clientX ?? 0) - LOUPE_OFFSET - LOUPE_PX;
  if (loupeTop + loupeContentH + 12 > window.innerHeight) loupeTop = (hover?.clientY ?? 0) - LOUPE_OFFSET - loupeContentH;

  return <div
    className="fixed inset-0 z-1000050"
    style={{cursor: 'crosshair', pointerEvents: 'auto'}}
    onPointerMove={event => readAt(event.clientX, event.clientY)}
    onPointerDown={event => {
      event.preventDefault();
      event.stopPropagation();
    }}
    onPointerUp={commit}
    onContextMenu={event => {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }}
  >
    <div
      className="pointer-events-none fixed z-1000051 flex flex-col items-center"
      style={{left: loupeLeft, top: loupeTop, visibility: hover ? 'visible' : 'hidden'}}
    >
      <div className="overflow-hidden rounded-full border-2 border-zinc-100 shadow-2xl"
           style={{width: LOUPE_PX, height: LOUPE_PX}}>
        <canvas ref={loupeRef} width={LOUPE_PX} height={LOUPE_PX} className="block"/>
      </div>
      <div
        className="mt-1.5 flex items-center justify-center rounded-md border-2 border-zinc-100 font-mono text-sm font-bold tracking-wide shadow-lg"
        style={{
          width: LOUPE_PX,
          height: 44,
          background: hover?.hex ?? 'transparent',
          color: hover?.textColor ?? '#fff'
        }}>
        {hover?.hex ?? ''}
      </div>
    </div>
  </div>;
}
