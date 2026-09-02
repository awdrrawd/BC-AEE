import {useEffect, useMemo, useRef, useState} from 'react';
import {Search, X} from 'lucide-react';
import {t} from '@/i18n/i18n';
import {Panel} from '@/components/ui/Panel';
import {fuzzyMatch, hasSearchText} from './searchText';

type Kind = 'all' | 'clothing' | 'item';
type Occurrence = {asset: Asset; group: AssetGroup};
type AssetEntry = {name: string; description: string; occurrences: Occurrence[]};
type PartEntry = {key: string; name: string; images: string[]};

const ASSET_BATCH_SIZE = 12;

function isClothing(group: AssetGroup): boolean {
  return group.Clothing || group.Underwear;
}

function isItem(group: AssetGroup): boolean {
  // BC's interactive inventory is exactly the Item-category groups (the 28
  // interaction slots). IsRestraint is also present on some appearance/body
  // groups, so it must not be used as the category boundary here.
  return group.IsItem();
}

function matchesKind(group: AssetGroup, kind: Kind): boolean {
  return kind === 'all' || (kind === 'clothing' ? isClothing(group) : isItem(group));
}

function buildEntries(): AssetEntry[] {
  const entries = new Map<string, AssetEntry>();
  for (const group of AssetGroup) {
    if (!isClothing(group) && !isItem(group)) continue;
    for (const asset of group.Asset) {
      const entry = entries.get(asset.Name) ?? {name: asset.Name, description: asset.Description || asset.Name, occurrences: []};
      entry.occurrences.push({asset, group});
      if (entry.description === entry.name && asset.Description) entry.description = asset.Description;
      entries.set(asset.Name, entry);
    }
  }
  return [...entries.values()].sort((a, b) => a.description.localeCompare(b.description));
}

function previewUrl(asset: Asset): string {
  const character = CharacterAppearanceSelection;
  const suffix = character && typeof asset.DynamicPreviewImage === 'function' ? asset.DynamicPreviewImage(character) : '';
  return `${AssetGetPreviewPath(asset)}/${asset.Name}${suffix}.png`;
}

function layerUrls(asset: Asset, layer: AssetLayer): string[] {
  if (!layer.Name) return [previewUrl(asset)];
  const assetRoot = AssetGetPreviewPath(asset).replace(/\/Preview\/?$/, '');
  // This is the same default TypeRecord resolution used by CommonDraw: every
  // CreateLayerTypes key contributes `${key}${TypeRecord[key] || 0}` before
  // the layer name (for example BallGagMask_typed0_Ball.png).
  const layerType = layer.CreateLayerTypes.map(key => `${key}0`).join('');
  const parentGroup = layer.ParentGroup[PoseType.DEFAULT];
  const parentName = parentGroup
    ? CharacterAppearanceSelection?.Appearance.find(item => item.Asset.Group.Name === parentGroup)?.Asset.Name ?? ''
    : '';
  let poseFolder = '';
  try {
    const pose = CharacterAppearanceSelection ? CommonDrawResolveAssetPose(CharacterAppearanceSelection, layer) : null;
    const mapped = pose ? layer.PoseMapping[pose] : null;
    if (mapped && mapped !== PoseType.HIDE) poseFolder = `${mapped}/`;
  } catch { /* default-pose candidates remain valid */ }
  const folders = poseFolder ? [`${assetRoot}/${poseFolder}`, `${assetRoot}/`] : [`${assetRoot}/`];
  const suffixes = [
    [parentName, layerType, layer.Name],
    [parentName, layer.Name],
    [layerType, layer.Name],
    [layer.Name],
  ].map(parts => parts.filter(Boolean).join('_'));
  return [...new Set(folders.flatMap(folder => suffixes.map(suffix => `${folder}${asset.Name}_${suffix}.png`)))];
}

function partsOf(entry: AssetEntry | null): PartEntry[] {
  if (!entry) return [];
  const parts = new Map<string, PartEntry>();
  for (const {asset} of entry.occurrences) {
    for (const [index, layer] of (asset.Layer ?? []).entries()) {
      const name = layer.Name || asset.Name;
      const existing = parts.get(name);
      const images = layerUrls(asset, layer);
      if (existing) {
        for (const image of images) if (!existing.images.includes(image)) existing.images.push(image);
      } else parts.set(name, {key: `${name}:${index}`, name, images});
    }
  }
  return [...parts.values()];
}

function AssetImage({src, alt, className, lazy = false, priority = false}: {src: string | string[]; alt: string; className: string; lazy?: boolean; priority?: boolean}) {
  const sources = typeof src === 'string' ? [src] : src;
  const sourceKey = sources.join('|');
  const [attempt, setAttempt] = useState({key: sourceKey, index: 0});
  const sourceIndex = attempt.key === sourceKey ? attempt.index : 0;
  const current = sources[Math.min(sourceIndex, sources.length - 1)] ?? '';
  // Custom-asset managers (notably ECHO) remap BC's virtual Assets/... URL to
  // their CDN inside DrawGetImage. A raw DOM <img> bypasses that mapping and
  // therefore 404s even though BC can draw the same layer normally.
  const resolved = resolveAssetUrl(current);
  return <img key={resolved} src={resolved} alt={alt} draggable={false} className={className}
              loading={lazy ? 'lazy' : 'eager'} fetchPriority={priority ? 'high' : 'auto'}
              onLoad={event => { event.currentTarget.style.visibility = 'visible'; }}
              onError={event => {
                if (sourceIndex + 1 < sources.length) setAttempt({key: sourceKey, index: sourceIndex + 1});
                else event.currentTarget.style.visibility = 'hidden';
              }}/>
}

function resolveAssetUrl(url: string): string {
  try { return DrawGetImage(url)?.src || url; } catch { return url; }
}

type Crop = {x: number; y: number; w: number; h: number};

function findVisibleCrop(image: HTMLImageElement): Crop {
  const width = image.naturalWidth || image.width, height = image.naturalHeight || image.height;
  const scale = Math.min(1, 256 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width * scale));
  canvas.height = Math.max(1, Math.ceil(height * scale));
  const context = canvas.getContext('2d', {willReadFrequently: true});
  if (!context) return {x: 0, y: 0, w: width, h: height};
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  try {
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] < 8) continue;
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    if (maxX < minX || maxY < minY) return {x: 0, y: 0, w: width, h: height};
    const padding = Math.max(2, Math.ceil(Math.max(maxX - minX, maxY - minY) * 0.08));
    minX = Math.max(0, minX - padding); minY = Math.max(0, minY - padding);
    maxX = Math.min(canvas.width - 1, maxX + padding); maxY = Math.min(canvas.height - 1, maxY + padding);
    return {x: minX / scale, y: minY / scale, w: (maxX - minX + 1) / scale, h: (maxY - minY + 1) / scale};
  } catch {
    return {x: 0, y: 0, w: width, h: height};
  }
}

function AssetCanvas({src}: {src: string[]}) {
  const sourceKey = src.join('|');
  const [attempt, setAttempt] = useState({key: sourceKey, index: 0});
  const sourceIndex = attempt.key === sourceKey ? attempt.index : 0;
  const current = src[Math.min(sourceIndex, src.length - 1)] ?? '';
  const resolved = resolveAssetUrl(current);
  const [loaded, setLoaded] = useState<{key: string; image: HTMLImageElement; crop: Crop} | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({w: 1, h: 1});

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => setSize({w: Math.max(1, host.clientWidth), h: Math.max(1, host.clientHeight)});
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    const canRequestCors = !resolved.startsWith('data:') && !resolved.startsWith('blob:');
    const failCandidate = () => {
      if (sourceIndex + 1 < src.length) setAttempt({key: sourceKey, index: sourceIndex + 1}); else setLoaded(null);
    };
    const load = (cors: boolean) => {
      const image = new Image();
      if (cors) image.crossOrigin = 'anonymous';
      image.onload = () => {
        if (!active) return;
        const crop = cors || !canRequestCors ? findVisibleCrop(image) : {x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight};
        setLoaded({key: resolved, image, crop});
      };
      image.onerror = () => {
        if (!active) return;
        // A third-party CDN may serve a valid image without CORS headers. It
        // cannot be alpha-scanned, but it can still be displayed and manually
        // zoomed, so retry the same source without crossOrigin before falling
        // through to the next filename candidate.
        if (cors) load(false); else failCandidate();
      };
      image.src = resolved;
    };
    load(canRequestCors);
    return () => { active = false; };
  }, [resolved, sourceIndex, sourceKey, src.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(size.w * ratio));
    canvas.height = Math.max(1, Math.round(size.h * ratio));
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = '#C4C4C4';
    context.fillRect(0, 0, size.w, size.h);
    if (!loaded || loaded.key !== resolved) return;
    const {image, crop} = loaded;
    const fit = Math.min(size.w / crop.w, size.h / crop.h) * 0.9;
    const width = crop.w * fit, height = crop.h * fit;
    const x = (size.w - width) / 2, y = (size.h - height) / 2;
    context.drawImage(image, crop.x, crop.y, crop.w, crop.h, x, y, width, height);
  }, [loaded, resolved, size]);

  return <div ref={hostRef} className="relative h-full w-full overflow-hidden">
    <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true"/>
  </div>;
}

export function AssetPartsSearchPanel({open, onClose}: {open: boolean; onClose: () => void}) {
  const entries = useMemo(buildEntries, [open]);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const [slot, setSlot] = useState('-');
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(ASSET_BATCH_SIZE);
  const listRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const slots = useMemo(() => {
    const groups = new Map<string, string>();
    for (const entry of entries) for (const {group} of entry.occurrences) {
      if (matchesKind(group, kind)) groups.set(group.Name, group.Description || group.Name);
    }
    return [...groups].sort((a, b) => a[1].localeCompare(b[1]));
  }, [entries, kind]);
  const filtered = useMemo(() => entries.flatMap(entry => {
    const hasQuery = hasSearchText(query);
    if (!hasQuery && slot === '-') return [];
    const occurrences = entry.occurrences.filter(({group}) =>
      matchesKind(group, kind)
      && (slot === '-' || slot === 'all' || group.Name === slot));
    if (!occurrences.length) return [];
    const description = occurrences[0].asset.Description || entry.name;
    return fuzzyMatch(`${entry.name} ${description} ${occurrences.map(({asset, group}) => `${asset.Description} ${group.Name} ${group.Description}`).join(' ')}`, query)
      ? [{...entry, description, occurrences}] : [];
  }), [entries, kind, query, slot]);
  const shown = filtered.slice(0, visibleCount);
  const selected = selectedName ? filtered.find(entry => entry.name === selectedName) ?? null : null;
  const parts = partsOf(selected);
  const part = parts.find(candidate => candidate.key === selectedPart) ?? parts[0] ?? null;
  const selectedIsBoth = !!selected
    && selected.occurrences.some(({group}) => isClothing(group))
    && selected.occurrences.some(({group}) => isItem(group));

  useEffect(() => {
    const root = listRef.current, target = loadMoreRef.current;
    if (!root || !target || visibleCount >= filtered.length) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisibleCount(count => Math.min(count + ASSET_BATCH_SIZE, filtered.length));
    }, {root, rootMargin: '180px 0px'});
    observer.observe(target);
    return () => observer.disconnect();
  }, [filtered.length, visibleCount]);

  const resetSelection = () => {
    setVisibleCount(ASSET_BATCH_SIZE);
    setSelectedName(null);
    setSelectedPart(null);
  };

  return <div className={`absolute inset-0 z-60 bg-black/75 transition ${open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} onClick={onClose}>
    <Panel role="dialog" aria-modal="true" className="h-full min-h-0 w-full rounded-none text-white" onClick={event => event.stopPropagation()}>
      <header className="relative flex h-[54px] shrink-0 items-center justify-center border-b border-zinc-700 bg-zinc-950/90 px-5">
        <h2 className="flex items-center gap-3 text-xl font-bold text-(--aee-accent)"><Search className="h-6 w-6"/>{t('asset-parts-search-title')}</h2>
        <button type="button" className="absolute right-3 flex h-10 w-10 items-center justify-center rounded border border-red-700 bg-red-950/70 hover:bg-red-800" onClick={onClose}><X className="h-6 w-6"/></button>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[31%_35%_34%]">
        <section className="flex min-h-0 min-w-0 flex-col border-r border-zinc-700">
          <div className="grid shrink-0 gap-2 border-b border-zinc-700 p-3">
            <label className="relative min-w-0"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"/><input value={query} onChange={event => {setQuery(event.target.value); resetSelection();}} placeholder={t('asset-parts-search-placeholder')} className="h-10 min-w-0 w-full rounded border border-zinc-600 bg-zinc-950 pl-9 pr-3 outline-none focus:border-(--aee-accent)"/></label>
            <select value={kind} onChange={event => {setKind(event.target.value as Kind); setSlot('-'); resetSelection();}} className="h-10 min-w-0 w-full rounded border border-zinc-600 bg-zinc-950 px-3"><option value="all">{t('asset-parts-search-kind-all')}</option><option value="clothing">{t('asset-parts-search-kind-clothing')}</option><option value="item">{t('asset-parts-search-kind-item')}</option></select>
            <select value={slot} onChange={event => {setSlot(event.target.value); resetSelection();}} className="h-10 min-w-0 w-full rounded border border-zinc-600 bg-zinc-950 px-3"><option value="-">-</option><option value="all">{t('asset-parts-search-slot-all')}</option>{slots.map(([name, label]) => <option key={name} value={name}>{label} ({name})</option>)}</select>
          </div>
          <div ref={listRef} className="aee-scroll min-h-0 flex-1 overflow-y-auto p-2">
            {shown.map(entry => <button type="button" key={entry.name} className={`mb-1.5 flex w-full items-center gap-3 rounded border p-2 text-left ${selected?.name === entry.name ? 'border-(--aee-accent) bg-(--aee-accent-22)' : 'border-zinc-700 bg-zinc-900 hover:border-(--aee-accent-55)'}`} onClick={() => { setSelectedName(entry.name); setSelectedPart(null); }}>
              <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-[#C4C4C4]"><AssetImage src={previewUrl(entry.occurrences[0].asset)} alt="" className="h-full w-full object-contain" lazy/></span>
              <span className="min-w-0"><strong className="block truncate">{entry.description}</strong><small className="block truncate text-zinc-400">{entry.name}</small></span>
            </button>)}
            {visibleCount < filtered.length ? <div ref={loadMoreRef} className="h-px" aria-hidden="true"/> : null}
            {!filtered.length ? <p className="p-5 text-center text-zinc-400">{t('asset-parts-search-empty')}</p> : null}
          </div>
        </section>
        <section className="flex min-h-0 min-w-0 flex-col border-r border-zinc-700">
          <h3 className="shrink-0 border-b border-zinc-700 px-4 py-3 font-bold">{t('asset-parts-search-parts')}</h3>
          <div className="aee-scroll grid min-h-0 flex-1 auto-rows-min grid-cols-3 gap-3 overflow-y-auto p-3">
            {parts.map(candidate => <button type="button" key={candidate.key} className={`flex aspect-square min-w-0 flex-col overflow-hidden rounded border ${part?.key === candidate.key ? 'border-(--aee-accent) bg-(--aee-accent-22)' : 'border-zinc-700 bg-zinc-900 hover:border-(--aee-accent-55)'}`} onClick={() => setSelectedPart(candidate.key)}>
              <span className="flex min-h-0 flex-1 items-center justify-center bg-[#C4C4C4]"><AssetCanvas src={candidate.images}/></span><span className="shrink-0 truncate px-2 py-1.5 text-sm">{candidate.name}</span>
            </button>)}
          </div>
        </section>
        <section className="flex min-h-0 min-w-0 flex-col p-5">
          <h3 className="mb-3 flex shrink-0 items-center gap-2 font-bold"><span>{part?.name ?? selected?.description ?? t('asset-parts-search-preview')}</span>{selectedIsBoth ? <small className="rounded border border-(--aee-accent-55) px-2 py-0.5 text-(--aee-accent)">{t('asset-parts-search-kind-both')}</small> : null}</h3>
          <div className="flex h-[55%] w-full shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#C4C4C4]">{part ? <AssetCanvas src={part.images}/> : null}</div>
          <h4 className="mb-2 mt-4 shrink-0 font-bold">{t('asset-parts-search-locations')}</h4>
          <div className="aee-scroll min-h-0 flex-1 overflow-y-auto rounded border border-zinc-700 bg-zinc-950/70 p-2">
            {selected?.occurrences.map(({group}) => <div key={group.Name} className="border-b border-zinc-800 px-2 py-1.5 last:border-0"><span>{group.Description || group.Name}</span><small className="ml-2 text-zinc-500">{group.Name}</small><small className="ml-2 text-(--aee-accent)">{t(isClothing(group) ? 'asset-parts-search-kind-clothing' : 'asset-parts-search-kind-item')}</small></div>)}
          </div>
        </section>
      </div>
    </Panel>
  </div>;
}
