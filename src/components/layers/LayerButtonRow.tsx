import type {LayerId} from '@/core/types';
import {openLayerColorPicker, selectLayer, startHoverHighlight, stopHoverHighlight} from '@/controllers/uiController';
import {getState} from '@/core/store';
import {settings} from '@/core/settings';
import {t} from '@/i18n/i18n';

export function LayerButtonRow({id, name, color, selected}: {
  id: LayerId;
  name: string;
  color: string | null;
  selected: boolean
}) {
  const hoverStart = () => {
    const state = getState();
    if (settings.hoverHighlight.get() && state.item) startHoverHighlight(state.item, id);
  };
  const hoverEnd = () => {
    if (settings.hoverHighlight.get()) stopHoverHighlight(true);
  };

  return <div
    className={[
      'mb-1 flex h-9 w-full items-center rounded border text-left text-sm font-semibold transition',
      selected ? 'border-(--aee-accent) bg-(--aee-accent-16) text-(--aee-accent)' : 'border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-(--aee-accent)',
    ].join(' ')}
    data-select-layer={id}
    data-aee-layer-button="1"
    onMouseEnter={hoverStart}
    onMouseLeave={hoverEnd}
  >
    <button
      className="h-full min-w-0 flex-1 overflow-hidden px-2 text-left font-semibold text-ellipsis whitespace-nowrap"
      onClick={() => selectLayer(id)}
    >{name}</button>
    <button
      className="relative mr-2 h-5 w-5 shrink-0 overflow-hidden rounded border border-white/20 bg-[repeating-conic-gradient(#333_0%_25%,#222_0%_50%)] bg-size-[6px_6px] transition hover:scale-110 hover:border-teal-300 focus-visible:outline-2 focus-visible:outline-teal-300"
      title={t('toggle-bar-color-picker-button-title')}
      aria-label={`${name}: ${t('toggle-bar-color-picker-button-title')}`}
      onClick={() => {
        selectLayer(id);
        openLayerColorPicker(id);
      }}
    >
      <span className="absolute inset-0" style={color ? {background: color} : undefined}/>
    </button>
  </div>;
}
