import {type CSSProperties, useEffect, useRef} from 'react';
import {CHARACTER_HEIGHT, CHARACTER_WIDTH, drawCharacterTo} from '@/util/characterCanvas';

export function CharacterCanvas({
  character,
  className,
  style,
}: {
  character: Character | null | undefined;
  className?: string;
  style?: CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    const paint = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawCharacterTo(ctx, character, 1);
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(frame);
  }, [character]);

  return <canvas
    ref={canvasRef}
    width={CHARACTER_WIDTH}
    height={CHARACTER_HEIGHT}
    className={className}
    style={style}
  />;
}
