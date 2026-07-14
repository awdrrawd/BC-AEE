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

function requiredImages(character: Character): string[] {
  const urls: string[] = [];
  const masks = (options?: {readonly TextureAlphaMask?: readonly TextureAlphaMask[]}) => {
    for (const mask of options?.TextureAlphaMask ?? []) urls.push(mask.Url);
  };
  const image = (src: string, _x: number, _y: number, options?: DrawOptions) => {
    urls.push(src);
    masks(options);
  };
  const canvas = (
    _img: HTMLImageElement | HTMLCanvasElement,
    _x: number,
    _y: number,
    _alphaMasks?: RectTuple[],
    maskLayers?: TextureAlphaMask[],
  ) => masks({TextureAlphaMask: maskLayers});
  const ignore = () => { /* nothing to collect from a clear */ };

  CommonDrawAppearanceBuild(character, {
    clearRect: ignore,
    clearRectBlink: ignore,
    drawImage: image,
    drawImageBlink: image,
    drawImageColorize: image,
    drawImageColorizeBlink: image,
    drawCanvas: canvas,
    drawCanvasBlink: canvas,
  });
  return urls;
}

function pendingImages(character: Character): HTMLImageElement[] {
  const pending = new Set<HTMLImageElement>();
  for (const url of requiredImages(character)) {
    const image = GLDrawImageCache.get(url) ?? DrawCacheImage.get(url);
    if (image && !image.complete) pending.add(image);
  }
  return [...pending];
}

function whenSettled(images: readonly HTMLImageElement[], timeout: number): Promise<void> {
  return new Promise(resolve => {
    let remaining = images.length;
    const timer = window.setTimeout(resolve, timeout);
    const settled = () => {
      if (--remaining > 0) return;
      window.clearTimeout(timer);
      resolve();
    };

    for (const image of images) {
      image.addEventListener('load', settled, {once: true});
      image.addEventListener('error', settled, {once: true});
    }
  });
}

export class CharacterPreview extends Component<Props, State> {
  state: State = {painted: false, loading: false};

  private readonly canvasRef = createRef<HTMLCanvasElement>();
  private observer: IntersectionObserver | null = null;
  private visible = false;

  private character: Character | null = null;
  private token = 0;
  private drawn: Snapshot | null = null;
  private drawing: Snapshot | null = null;

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
    this.token++;
    this.release();
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

    if (sameSnapshot(this.drawn, wanted) || sameSnapshot(this.drawing, wanted)) return;

    this.drawing = wanted;
    void this.draw(wearer, outfit, pose, wanted);
  }

  private async draw(
    wearer: Character,
    outfit: readonly ItemBundle[] | null,
    pose: readonly AssetPoseName[],
    wanted: Snapshot,
  ) {
    const token = ++this.token;
    this.release();
    this.setState({loading: true});

    const character = CharacterLoadSimple(`AeeWardrobePreview-${++previewSerial}`);
    this.character = character;

    try {
      character.Appearance = [];
      const body = bundleAppearance(wearer.Appearance.filter(item => isBodyGroup(item.Asset.Group)));
      for (const entry of body) wearBundle(character, entry);
      if (outfit) for (const entry of outfit) wearBundle(character, entry);

      CharacterRefresh(character, false, false);
      for (const name of pose) PoseSetActive(character, name, true);

      const complete = await this.load(character, token);
      if (token !== this.token) return; // a newer draw (or an unmount) took over

      this.paint(character);
      this.drawn = complete ? wanted : null;
      if (!complete) console.warn('🐈‍⬛ [AEE] An outfit preview timed out while loading its art');
    } catch (error) {
      console.warn('🐈‍⬛ [AEE] Failed to render an outfit preview', error);
      if (token !== this.token) return;
      this.drawn = null;
    } finally {
      if (this.character === character) this.release();
      else discard(character);

      if (token === this.token) {
        this.drawing = null;
        this.setState(state => ({painted: state.painted || this.drawn !== null, loading: false}));
      }
    }
  }

  private async load(character: Character, token: number): Promise<boolean> {
    const deadline = performance.now() + LOAD_TIMEOUT;

    for (;;) {
      CharacterLoadCanvas(character); // also requests every image the layers need
      const pending = pendingImages(character);
      if (pending.length === 0) return true;

      const left = deadline - performance.now();
      if (left <= 0) return false;

      await whenSettled(pending, left);
      if (token !== this.token) return false;
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

function discard(character: Character) {
  CharacterDelete(character, false);
  character.Canvas = null;
  character.CanvasBlink = null;
  character.Appearance = [];
}
