import type {LayerId} from '@/core/types';
import {selectLayer, startHoverHighlight, stopHoverHighlight} from '@/controllers/uiController';
import {getState} from '@/core/store';
import {settings} from '@/core/settings';

export function LayerButtonRow({id, name, color, selected}: {
  id: LayerId;
  name: string;
  color: string | null;
  selected: boolean
}) {
  return <button
    className={[
      'mb-1 flex h-9 w-full items-center justify-between gap-2 rounded border px-2 text-left text-sm font-semibold transition',
      selected ? 'border-(--aee-accent) bg-(--aee-accent-16) text-(--aee-accent)' : 'border-zinc-700 bg-zinc-900 text-zinc-100 hover:border-(--aee-accent)',
    ].join(' ')}
    data-select-layer={id}
    data-aee-layer-button="1"
    onClick={() => selectLayer(id)}
    onMouseEnter={() => {
      const state = getState();
      if (settings.hoverHighlight.get() && state.item) startHoverHighlight(state.item, id);
    }}
    onMouseLeave={() => {
      if (settings.hoverHighlight.get()) stopHoverHighlight(true);
    }}
  >
    <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{name}</span>
    <span
      className="relative h-4 w-4 shrink-0 overflow-hidden rounded border border-white/15 bg-[repeating-conic-gradient(#333_0%_25%,#222_0%_50%)] bg-size-[6px_6px]">
      <span className="absolute inset-0" style={color ? {background: color} : undefined}/>
    </span>
  </button>;
}
