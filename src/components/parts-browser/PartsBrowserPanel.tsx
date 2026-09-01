import {useEffect, useState} from 'react';
import type {AeeState, LayerId} from '@/core/types';
import {getEditableParts} from '@/core/bc';
import {selectLayer, startHoverHighlight, stopHoverHighlight} from '@/controllers/uiController';
import {Button} from '@/components/ui/Button';
import {Grid3x2, List, Search, X} from 'lucide-react';
import {t} from '@/i18n/i18n';
import {getCapturedLayerThumbnail, setLayerPanelHover} from '@/controllers/appearancePickerController';

type BrowserMode = 'list' | 'grid';

function previewUrl(item: Item): string {
  const character = CharacterAppearanceSelection;
  const suffix = character && typeof item.Asset.DynamicPreviewImage === 'function'
    ? item.Asset.DynamicPreviewImage(character) : '';
  return `${AssetGetPreviewPath(item.Asset)}/${item.Asset.Name}${suffix}.png`;
}

export function PartsBrowserPanel({state, open, onClose}: {state: AeeState; open: boolean; onClose: () => void}) {
  const [mode, setMode] = useState<BrowserMode>('list');
  const [magnify, setMagnify] = useState(false);
  const [hovered, setHovered] = useState<{id: LayerId; name: string} | null>(null);
  const item = state.item;
  const parts = item ? [{layerId: 'all', name: t('layer-list-all-parts-row')}, ...getEditableParts(item)] : [];
  const image = item ? previewUrl(item) : '';
  const partImage = (id: LayerId) => id === 'all' ? image : getCapturedLayerThumbnail(Number.parseInt(id, 10)) ?? image;

  useEffect(() => {
    if (open) return;
    setHovered(null);
    stopHoverHighlight(true);
  }, [open]);

  const enter = (id: LayerId, name: string) => {
    setHovered({id, name});
    setLayerPanelHover(String(id));
    if (!magnify && item) startHoverHighlight(item, id);
  };
  const leave = () => {
    setHovered(null);
    setLayerPanelHover(null);
    if (!magnify) stopHoverHighlight(true);
  };
  const choose = (id: LayerId) => {
    setLayerPanelHover(null);
    stopHoverHighlight(true);
    selectLayer(id);
    onClose();
  };

  return <div className={`aee-panel-collapse-motion pointer-events-none absolute inset-0 z-50`}>
    <div className={`pointer-events-auto absolute bottom-0 right-0 top-0 flex w-[40%] min-w-[420px] flex-col overflow-visible border-l-2 border-(--aee-accent-55) bg-(--aee-panel-bg) shadow-(--aee-panel-shadow) transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-zinc-700 bg-zinc-900 px-3">
      <span className="mr-auto text-[19px] font-bold text-white">{t('parts-browser-title')}</span>
      <div className="grid h-9 w-[92px] grid-cols-2 overflow-hidden rounded border border-(--aee-accent-55)">
        <button type="button" title={t('parts-browser-list-view')} className={`flex items-center justify-center ${mode === 'list' ? 'bg-(--aee-accent-35) text-white' : 'bg-(--aee-control-bg) text-zinc-300'}`} onClick={() => setMode('list')}><List className="h-5.5 w-5.5"/></button>
        <button type="button" title={t('parts-browser-grid-view')} className={`flex items-center justify-center border-l border-(--aee-accent-55) ${mode === 'grid' ? 'bg-(--aee-accent-35) text-white' : 'bg-(--aee-control-bg) text-zinc-300'}`} onClick={() => setMode('grid')}><Grid3x2 className="h-5.5 w-5.5"/></button>
      </div>
      <Button iconOnly title={t('parts-browser-magnify')} className="h-9 w-9" selected={magnify} onClick={() => { stopHoverHighlight(true); setMagnify(value => !value); }}><Search className="h-5.5 w-5.5"/></Button>
      <Button iconOnly tone="danger" className="h-9 w-9" onClick={onClose}><X className="h-5.5 w-5.5"/></Button>
    </div>
    <div className={`aee-scroll min-h-0 flex-1 overflow-y-auto p-3 ${mode === 'grid' ? 'grid auto-rows-min grid-cols-3 gap-3' : 'flex flex-col gap-2'}`} onMouseLeave={leave}>
      {parts.map(part => <button key={part.layerId} type="button"
        className={`${mode === 'grid' ? 'flex aspect-square flex-col' : 'flex h-20'} min-w-0 shrink-0 items-center overflow-hidden rounded border text-white transition ${state.selectedLayer === part.layerId ? 'border-(--aee-accent) bg-(--aee-accent-22)' : 'border-zinc-700 bg-zinc-900 hover:border-(--aee-accent-55)'}`}
        onMouseEnter={() => enter(part.layerId, part.name)} onMouseLeave={leave} onClick={() => choose(part.layerId)}>
        <span className={`${mode === 'grid' ? 'h-[76%] w-full' : 'h-full w-20'} shrink-0 bg-[#C4C4C4] bg-contain bg-center bg-no-repeat`} style={{backgroundImage: `url("${partImage(part.layerId)}")`}}/>
        <span className={`${mode === 'grid' ? 'w-full px-1 text-center text-[17px]' : 'min-w-0 flex-1 px-3 text-left text-[19px]'} truncate`}>{part.name}</span>
      </button>)}
    </div>
    {magnify && hovered ? <div className="pointer-events-none absolute right-full top-12 mr-2 w-52 rounded-lg border-2 border-(--aee-accent) bg-black/90 p-2 shadow-xl">
      <div className="aspect-square bg-[#C4C4C4] bg-contain bg-center bg-no-repeat" style={{backgroundImage: `url("${partImage(hovered.id)}")`}}/>
      <div className="mt-1 truncate text-center text-[19px] text-white">{hovered.name}</div>
    </div> : null}
  </div>
  </div>;
}
