import {Component, createRef} from 'react';
import cn from '@/util/cn';
import {bundleAppearance, wearBundle} from '@/util/appearanceBundle';
import {CHARACTER_HEIGHT, CHARACTER_WIDTH, drawCharacterTo} from '@/util/characterCanvas';
import {getTargetCharacter} from '@/core/wardrobeStore';

const RESOLUTION = 0.5;
const PICTURE_WIDTH = CHARACTER_WIDTH * RESOLUTION;
const PICTURE_HEIGHT = CHARACTER_HEIGHT * RESOLUTION;
const LOAD_TIMEOUT = 15_000;

let previewSerial = 0;

function cachedImageKeys(): Set<string> {
  const keys = new Set<string>();
  for (const key of GLDrawImageCache.keys()) keys.add(key);
  for (const key of DrawCacheImage.keys()) keys.add(key);
  return keys;
}

function allComplete(urls: readonly string[]): boolean {
  for (const url of urls) {
    const image = GLDrawImageCache.get(url) ?? DrawCacheImage.get(url);
    if (image && image.complete === false) return false;
  }
  return true;
}

interface Props {
  appearance: readonly ItemBundle[] | null | undefined;
  pose?: readonly AssetPoseName[] | null;
  wearer?: Character | null;
  className?: string;
}

interface State {
  painted: boolean;
  loading: boolean;
}

interface Snapshot {
  outfit: readonly ItemBundle[] | null;
  pose: string;
  body: string;
}

function sameSnapshot(a: Snapshot | null, b: Snapshot): boolean {
  return !!a && a.outfit === b.outfit && a.pose === b.pose && a.body === b.body;
}

function isBodyGroup(group: AssetGroup): boolean {
  return group.Category === 'Appearance' && !group.Clothing;
}

function outfitHasBody(family: IAssetFamily, outfit: readonly ItemBundle[] | null): boolean {
  return !!outfit?.some(entry => {
    const group = AssetGroupGet(family, entry.Group);
    return !!group && isBodyGroup(group);
  });
}

function bodySignature(character: Character): string {
  return character.Appearance
    .filter(item => isBodyGroup(item.Asset.Group))
    .map(item => [
      item.Asset.Group.Name,
      item.Asset.Name,
      JSON.stringify(item.Color ?? null),
      JSON.stringify(item.Property ?? null),
    ].join('/'))
    .join('|');
}

export class CharacterPreview extends Component<Props, State> {
  private static readonly live = new Set<CharacterPreview>();
  private static frame = 0;

  private static schedule() {
    if (CharacterPreview.frame) return;
    const tick = () => {
      for (const preview of CharacterPreview.live) preview.refresh();
      CharacterPreview.frame = CharacterPreview.live.size ? requestAnimationFrame(tick) : 0;
    };
    CharacterPreview.frame = requestAnimationFrame(tick);
  }

  state: State = {painted: false, loading: false};

  private readonly canvasRef = createRef<HTMLCanvasElement>();
  private observer: IntersectionObserver | null = null;
  private visible = false;

  private character: Character | null = null;
  private built: Snapshot | null = null;
  private builtAt = 0;
  private awaiting: string[] = [];

  componentDidMount() {
    const canvas = this.canvasRef.current;
    if (!canvas) return;

    this.observer = new IntersectionObserver(
      entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        this.visible = true;
        this.sync();
      },
      {rootMargin: '200px'},
    );
    this.observer.observe(canvas);
  }

  componentDidUpdate() {
    this.sync();
  }

  componentWillUnmount() {
    this.observer?.disconnect();
    this.observer = null;
    this.visible = false;
    CharacterPreview.live.delete(this);
    this.release();
    releaseCanvas(this.canvasRef.current);
  }

  render() {
    const spinning = this.visible && this.state.loading && !this.state.painted;

    return <div className={cn('relative', this.props.className)}>
      <canvas
        ref={this.canvasRef}
        width={PICTURE_WIDTH}
        height={PICTURE_HEIGHT}
        className="h-full w-full object-contain"
      />

      {spinning ? <div className="aee-fade-in pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="aee-spinner h-9 w-9"/>
      </div> : null}
    </div>;
  }

  private sync() {
    if (!this.visible) return;

    const wearer = this.props.wearer ?? getTargetCharacter();
    const pose = this.props.pose ?? [];
    const outfit = this.props.appearance?.length ? this.props.appearance : null;
    const wanted: Snapshot = {
      outfit,
      pose: pose.join(','),
      body: `${wearer.AssetFamily}|${bodySignature(wearer)}`,
    };

    if (sameSnapshot(this.built, wanted)) return;

    this.built = wanted;
    this.setState({loading: true, painted: false});
    this.build(wearer, outfit, pose);
  }

  private build(
    wearer: Character,
    outfit: readonly ItemBundle[] | null,
    pose: readonly AssetPoseName[],
  ) {
    this.release();
    this.builtAt = performance.now();
    CharacterPreview.live.add(this);
    CharacterPreview.schedule();

    const character = CharacterLoadSimple(`AeeWardrobePreview-${++previewSerial}`);
    this.character = character;

    try {
      character.Appearance = [];
      if (!outfitHasBody(wearer.AssetFamily, outfit)) {
        const body = bundleAppearance(wearer.Appearance.filter(item => isBodyGroup(item.Asset.Group)));
        for (const entry of body) wearBundle(character, entry);
      }
      if (outfit) for (const entry of outfit) wearBundle(character, entry);

      const before = cachedImageKeys();
      CharacterRefresh(character, false, false);
      for (const name of pose) PoseSetActive(character, name, true);
      CharacterLoadCanvas(character);
      this.paint(character);
      this.awaiting = [...cachedImageKeys()].filter(key => !before.has(key));
    } catch (error) {
      console.warn('🐈‍⬛ [AEE] Failed to render an outfit preview', error);
      this.awaiting = [];
      this.release();
      CharacterPreview.live.delete(this);
      this.setState({loading: false, painted: false});
    }
  }

  private refresh() {
    const character = this.character;
    if (!character || !this.visible) return;

    if (character.MustDraw) {
      try {
        CharacterLoadCanvas(character); // absorb art that just finished loading
        this.paint(character);
      } catch {
        return; // GL state briefly unusable — try again next frame
      }
    }

    const settled = allComplete(this.awaiting) || performance.now() - this.builtAt > LOAD_TIMEOUT;
    if (this.state.loading && !character.MustDraw && settled) {
      this.paint(character);
      this.awaiting = [];
      this.release();
      CharacterPreview.live.delete(this);
      this.setState({loading: false, painted: true});
    }
  }

  private release() {
    if (!this.character) return;
    discard(this.character);
    this.character = null;
  }

  private paint(character: Character) {
    const ctx = this.canvasRef.current?.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, PICTURE_WIDTH, PICTURE_HEIGHT);
    drawCharacterTo(ctx, character, RESOLUTION, {blink: false});
  }
}

function releaseCanvas(canvas: HTMLCanvasElement | null | undefined) {
  if (!canvas) return;
  canvas.width = 0;
  canvas.height = 0;
}

function releasePreviewTextures(characterId: string) {
  const prefix = `${characterId}__`;
  const gl = GLDrawCanvas?.GL;
  const textureCache = gl?.textureCache;

  if (gl && textureCache) {
    for (const [key, data] of textureCache) {
      if (!key.startsWith(prefix)) continue;
      gl.deleteTexture(data.texture);
      textureCache.delete(key);
    }
  }

  for (const key of GLDrawImageCache.keys()) {
    if (key.startsWith(prefix)) GLDrawImageCache.delete(key);
  }
}

function discard(character: Character) {
  const canvas = character.Canvas;
  const blinkCanvas = character.CanvasBlink;

  releasePreviewTextures(character.CharacterID);
  CharacterDelete(character, false);
  releaseCanvas(canvas);
  releaseCanvas(blinkCanvas);
  character.Canvas = null;
  character.CanvasBlink = null;
  character.Appearance = [];
}
