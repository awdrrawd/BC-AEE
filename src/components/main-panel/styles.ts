export const panelClass = 'z-[999999] flex h-full flex-col overflow-hidden border-r border-zinc-700 bg-zinc-950 text-zinc-100 shadow-2xl';
export const iconButtonClass = 'flex h-7 w-7 items-center justify-center rounded border border-transparent text-zinc-400 transition hover:bg-violet-500/15 hover:text-violet-200';
export const activeIconButtonClass = 'bg-violet-500/25 text-violet-200 shadow-[inset_-2px_0_0_#8b5cf6]';
export const stepButtonClass = 'flex h-6 min-w-0 flex-1 items-center justify-center rounded border border-zinc-700 bg-zinc-800 px-1 text-[11px] text-zinc-100 transition hover:border-violet-500 hover:bg-violet-600 hover:text-white';
export const resetButtonClass = 'flex h-6 w-7 shrink-0 items-center justify-center rounded border border-zinc-700 bg-zinc-800 text-xs text-zinc-400 transition hover:border-red-300 hover:bg-red-950/60 hover:text-red-200';
export const rangeClass = 'h-1 w-full cursor-pointer appearance-none rounded bg-zinc-800 accent-violet-500';

export const panelTabs = [
  ['edit', 'main-panel-tab-edit'],
  ['opacity', 'main-panel-tab-opacity'],
  ['layers', 'main-panel-tab-layers'],
  ['settings', 'main-panel-tab-settings'],
] as const;
