export const panelClass = 'z-[999999] h-full';
export const stepButtonClass = 'flex h-5 shrink-0 items-center justify-center rounded border border-zinc-700 px-1.5 text-[11px] transition hover:border-[var(--aee-accent)] hover:bg-[var(--aee-accent-65)]';
export const resetButtonClass = 'flex h-5 shrink-0 items-center justify-center rounded border border-zinc-700 px-1.5 text-[11px] text-zinc-400 transition hover:border-red-300 hover:text-red-200';
export const rangeClass = 'h-1 w-full cursor-pointer appearance-none rounded bg-zinc-800 accent-[var(--aee-accent)]';
export const tallRangeClass = 'aee-tall-range h-[25px] w-full cursor-pointer appearance-none bg-transparent';

export const panelTabs = [
  ['edit', 'main-panel-tab-edit'],
  ['opacity', 'main-panel-tab-opacity'],
  ['layers', 'main-panel-tab-layers'],
  ['settings', 'main-panel-tab-settings'],
] as const;
