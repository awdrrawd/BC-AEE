import {useEffect, useRef, useState} from 'react';
import {Clipboard, Download, X} from 'lucide-react';
import {t} from '@/i18n/i18n';
import cn from '@/util/cn';
import {showToast} from '@/util/toast';
import {bundleAppearance, wearBundle} from '@/util/appearanceBundle';
import {CHARACTER_HEIGHT, CHARACTER_WIDTH, drawCharacterTo} from '@/util/characterCanvas';
import {getTargetCharacter} from '@/core/wardrobeStore';
import {downloadBlob} from '@/core/wardrobeFile';
import {backgroundUrl} from '@/util/wardrobeBackground';
import {BACKGROUND_CHOICES, backgroundChoiceLabel} from '@/components/wardrobe/dialogs/backgroundChoices';
import {Button} from '@/components/ui/Button';
import {ColorInput, Select} from '@/components/ui/Fields';
import {Dialog} from '@/components/ui/Dialog';

type BgMode = 'color' | 'transparent' | 'image';

const OUTPUT_SCALE = 3;   // 1500 x 3000
const PREVIEW_SCALE = 0.4; // 200 x 400
const IMAGE_CHOICES = BACKGROUND_CHOICES.filter(choice => choice.type === 'image' && choice.path);

let photoSerial = 0;

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, w: number, h: number) {
  const scale = Math.max(w / image.width, h / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

export function PhotoDialog({onClose}: { onClose: () => void }) {
  const [bgMode, setBgMode] = useState<BgMode>('color');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [bgPath, setBgPath] = useState(IMAGE_CHOICES[0]?.path ?? '');
  const [busy, setBusy] = useState(false);

  const charRef = useRef<Character | null>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const renderRef = useRef<(ctx: CanvasRenderingContext2D, scale: number) => void>(() => {});

  // Build a throwaway copy of the target so rendering never touches the real character.
  useEffect(() => {
    const source = getTargetCharacter();
    const character = CharacterLoadSimple(`AeePhoto-${++photoSerial}`);
    charRef.current = character;
    try {
      character.Appearance = [];
      for (const entry of bundleAppearance(source.Appearance)) wearBundle(character, entry);
      CharacterRefresh(character, false, false);
      CharacterLoadCanvas(character);
    } catch (error) {
      console.warn('🐈‍⬛ [AEE] Failed to prepare the photo character', error);
    }

    let frame = requestAnimationFrame(function paint() {
      const canvas = previewRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) renderRef.current(ctx, PREVIEW_SCALE);
      frame = requestAnimationFrame(paint);
    });

    return () => {
      cancelAnimationFrame(frame);
      const character = charRef.current;
      if (character) {
        CharacterDelete(character, false);
        character.Canvas = null;
        character.CanvasBlink = null;
        character.Appearance = [];
      }
      charRef.current = null;
    };
  }, []);

  // Load the chosen wardrobe background image for compositing.
  useEffect(() => {
    if (bgMode !== 'image' || !bgPath) {
      bgImageRef.current = null;
      return;
    }
    const url = backgroundUrl(bgPath);
    if (!url) return;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      bgImageRef.current = image;
    };
    image.onerror = () => {
      bgImageRef.current = null;
    };
    image.src = url;
  }, [bgMode, bgPath]);

  function render(ctx: CanvasRenderingContext2D, scale: number) {
    const w = CHARACTER_WIDTH * scale;
    const h = CHARACTER_HEIGHT * scale;
    ctx.clearRect(0, 0, w, h);
    if (bgMode === 'color') {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, w, h);
    } else if (bgMode === 'image' && bgImageRef.current) {
      drawCover(ctx, bgImageRef.current, w, h);
    }
    if (charRef.current) drawCharacterTo(ctx, charRef.current, scale, {blink: false});
  }

  renderRef.current = render; // keep the preview loop pointed at the latest settings

  const buildBlob = (): Promise<Blob | null> => new Promise(resolve => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = CHARACTER_WIDTH * OUTPUT_SCALE;
      canvas.height = CHARACTER_HEIGHT * OUTPUT_SCALE;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }
      render(ctx, OUTPUT_SCALE);
      canvas.toBlob(resolve, 'image/png');
    } catch (error) {
      console.warn('🐈‍⬛ [AEE] Failed to render the photo', error);
      resolve(null);
    }
  });

  const fileName = () => {
    const date = new Date().toISOString().slice(0, 10);
    const name = (getTargetCharacter().Name || Player?.Name || 'player').replace(/[^\w-]/g, '') || 'player';
    return `aee-photo-${name}-${date}.png`;
  };

  const saveImage = async () => {
    setBusy(true);
    const blob = await buildBlob();
    setBusy(false);
    if (!blob) {
      showToast(t('wardrobe-photo-failed'));
      return;
    }
    downloadBlob(fileName(), blob);
    showToast(t('wardrobe-photo-saved'));
  };

  const copyImage = async () => {
    setBusy(true);
    const blob = await buildBlob();
    if (!blob || typeof ClipboardItem === 'undefined') {
      setBusy(false);
      if (blob) {
        downloadBlob(fileName(), blob); // clipboard images unsupported — fall back to a download
        showToast(t('wardrobe-photo-saved'));
      } else {
        showToast(t('wardrobe-photo-failed'));
      }
      return;
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
      showToast(t('wardrobe-photo-copied'));
    } catch (error) {
      console.warn('🐈‍⬛ [AEE] Failed to copy the photo', error);
      downloadBlob(fileName(), blob);
      showToast(t('wardrobe-photo-saved'));
    } finally {
      setBusy(false);
    }
  };

  const modeButton = (mode: BgMode, label: string) => <Button
    density="stage"
    className="h-11 flex-1"
    selected={bgMode === mode}
    onClick={() => setBgMode(mode)}
  >{label}</Button>;

  return <Dialog onDismiss={onClose} className="w-[720px] p-8">
    <header className="mb-5 flex shrink-0 items-center justify-between">
      <h1 className="text-[32px] text-[#f0eee4]">{t('wardrobe-photo-title')}</h1>
      <Button density="stage"
              className="h-9 w-9"
              onClick={onClose}
              icon={<X className="h-5 w-5"/>}
              aria-label={t('wardrobe-cancel')}
      />
    </header>

    <div className="flex gap-6">
      <div
        className="shrink-0 self-start overflow-hidden rounded-lg bg-[repeating-conic-gradient(#3a3a44_0%_25%,#2a2a32_0%_50%)] bg-size-[16px_16px]"
      >
        <canvas
          ref={previewRef}
          width={CHARACTER_WIDTH * PREVIEW_SCALE}
          height={CHARACTER_HEIGHT * PREVIEW_SCALE}
          className="block"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <section className="flex flex-col gap-2">
          <h3 className="text-[22px] text-white">{t('wardrobe-photo-bg')}</h3>
          <div className="flex gap-2">
            {modeButton('color', t('wardrobe-photo-bg-solid'))}
            {modeButton('transparent', t('wardrobe-photo-bg-transparent'))}
            {modeButton('image', t('wardrobe-photo-bg-image'))}
          </div>

          {bgMode === 'color' ? <div className="flex items-center gap-3">
            <ColorInput className="h-11 w-24" value={bgColor} ariaLabel={t('wardrobe-photo-bg-solid')}
                        onColorChange={setBgColor}/>
            <span className="font-mono text-[20px] uppercase text-white/60">{bgColor}</span>
          </div> : null}

          {bgMode === 'image' ? <Select density="stage" className="w-full" value={bgPath}
                                        onChange={event => setBgPath(event.currentTarget.value)}>
            {IMAGE_CHOICES.map(choice => <option key={choice.label} value={choice.path}>
              {backgroundChoiceLabel(choice)}
            </option>)}
          </Select> : null}
        </section>

        <div className={cn('mt-auto flex flex-col gap-2', busy && 'pointer-events-none opacity-60')}>
          <Button density="stage" className="h-12" onClick={() => void saveImage()}
                  icon={<Download className="h-5 w-5"/>}>{t('wardrobe-photo-save-image')}</Button>
          <Button density="stage" className="h-12" onClick={() => void copyImage()}
                  icon={<Clipboard className="h-5 w-5"/>}>{t('wardrobe-photo-save-clipboard')}</Button>
        </div>
      </div>
    </div>
  </Dialog>;
}
