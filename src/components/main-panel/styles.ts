export const panelClass = 'z-[999999] h-full';
export const stepButtonClass = 'flex h-7 min-w-0 flex-1 items-center justify-center rounded border border-[var(--aee-accent-35)] bg-[var(--aee-control-bg)] px-1 text-xs text-[var(--aee-text)] transition hover:border-[var(--aee-accent)] hover:bg-[var(--aee-accent-35)]';
export const resetButtonClass = 'flex h-7 w-8 shrink-0 items-center justify-center rounded border border-zinc-700 bg-zinc-800 text-sm text-zinc-400 transition hover:border-red-300 hover:bg-red-950/60 hover:text-red-200';
export const rangeClass = 'h-1 w-full cursor-pointer appearance-none rounded bg-zinc-800 accent-[var(--aee-accent)]';

export const panelTabs = [
  ['edit', 'main-panel-tab-edit'],
  ['opacity', 'main-panel-tab-opacity'],
  ['layers', 'main-panel-tab-layers'],
  ['settings', 'main-panel-tab-settings'],
] as const;
