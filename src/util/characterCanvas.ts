export const CHARACTER_WIDTH = 500;
export const CHARACTER_HEIGHT = 1000;

export function ensureCharacterCanvas(character: Character | null | undefined) {
  if (!character) return;
  if (character.Canvas && !character.MustDraw) return;
  try {
    CharacterLoadCanvas(character);
    character.MustDraw = false;
  } catch {
    // A character BC can't build yet simply renders empty this frame.
  }
}

function isBlinking(character: Character): boolean {
  return Math.round(CurrentTime / 400) % character.BlinkFactor === 0;
}

export interface DrawCharacterOptions {
  blink?: boolean;
}

export function drawCharacterTo(
  ctx: CanvasRenderingContext2D,
  character: Character | null | undefined,
  scale: number,
  options?: DrawCharacterOptions,
) {
  if (!character) return;
  ensureCharacterCanvas(character);

  const blinking = options?.blink ?? isBlinking(character);
  const source = (blinking ? character.CanvasBlink : character.Canvas) ?? character.Canvas;
  if (!source) return;

  const heightRatio = character.HeightRatio ?? 1;
  const xOffset = CharacterAppearanceXOffset(character, heightRatio);
  const yOffset = CharacterAppearanceYOffset(character, heightRatio);

  const cutOff = yOffset >= 0;
  const upperOverflow = CanvasUpperOverflow;
  const sourceY = upperOverflow + (cutOff ? -yOffset / heightRatio : 0);
  const sourceHeight = CHARACTER_HEIGHT / heightRatio + (cutOff ? 0 : -yOffset / heightRatio);
  const destY = cutOff ? 0 : yOffset;

  const sourceWidth = Math.min(source.width, CHARACTER_WIDTH);
  const sourceX = (source.width - sourceWidth) / 2;

  try {
    ctx.drawImage(
      source,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      xOffset * scale,
      destY * scale,
      CHARACTER_WIDTH * heightRatio * scale,
      (CHARACTER_HEIGHT - destY) * scale,
    );
  } catch {
    // A canvas BC is mid-rebuild on can briefly be un-drawable.
  }
}
