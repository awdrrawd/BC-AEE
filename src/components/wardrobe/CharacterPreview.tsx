import {Component, createRef} from 'react';
import cn from '@/util/cn';
import {bundleAppearance, wearBundle} from '@/util/appearanceBundle';
import {CHARACTER_HEIGHT, CHARACTER_WIDTH, drawCharacterTo} from '@/util/characterCanvas';
import {getTargetCharacter} from '@/core/wardrobeStore';

const RESOLUTION = 0.5;
const PICTURE_WIDTH = CHARACTER_WIDTH * RESOLUTION;
const PICTURE_HEIGHT = CHARACTER_HEIGHT * RESOLUTION;

let previewSerial = 0;

interface Props {
  appearance: readonly ItemBundle[] | null | undefined;
  pose?: readonly AssetPoseName[] | null;
  wearer?: Character | null;
  className?: string;
}

interface State {
  drawn: boolean;
  loading: boolean;
}

interface Drawn {
  outfit: readonly ItemBundle[] | null;
  pose: string;
  body: string;
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

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function imagesPending(): boolean {
  for (const image of DrawCacheImage.values()) {
    if (!image.complete) return true;
  }
  return false;
}

export class CharacterPreview extends Component<Props, State> {
  state: State = {drawn: false, loading: false};

  private readonly canvasRef = createRef<HTMLCanvasElement>();
  private observer: IntersectionObserver | null = null;
  private visible = false;

  private character: Character | null = null;
  private token = 0;
  private drawn: Drawn | null = null;

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
    const spinning = this.visible && this.state.loading && !this.state.drawn;

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
    const outfit = this.props.appearance?.length ? this.props.appearance : null;
    const wanted: Drawn = {
      outfit,
      pose: (this.props.pose ?? []).join(','),
      body: `${wearer.AssetFamily}|${bodySignature(wearer)}`,
    };

    const drawn = this.drawn;
    if (drawn && drawn.outfit === wanted.outfit && drawn.pose === wanted.pose && drawn.body === wanted.body) return;

    this.drawn = wanted;
    void this.draw(wearer, outfit, this.props.pose ?? []);
  }

  private async draw(
    wearer: Character,
    outfit: readonly ItemBundle[] | null,
    pose: readonly AssetPoseName[],
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

      if (pose.length > 0) {
        for (const name of pose) PoseSetActive(character, name, true);
        CharacterLoadCanvas(character);
      }

      await this.settle(character, token);
      if (token !== this.token) return;

      this.paint(character);
      this.setState({drawn: true, loading: false});
    } catch (error) {
      console.warn('🐈‍⬛ [AEE] Failed to render an outfit preview', error);
      if (token === this.token) this.setState({loading: false});
    } finally {
      if (this.character === character) this.release();
      else discard(character);
    }
  }

  private async settle(character: Character, token: number) {
    const deadline = performance.now() + 10_000;

    let quiet = 0;
    while (quiet < 2) {
      if (token !== this.token || performance.now() > deadline) return;
      await nextFrame();
      if (token !== this.token) return;

      if (character.MustDraw) {
        CharacterLoadCanvas(character);
        quiet = 0;
      } else if (imagesPending()) {
        quiet = 0;
      } else {
        quiet++;
      }
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
