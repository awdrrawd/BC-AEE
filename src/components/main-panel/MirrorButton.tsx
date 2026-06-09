export function MirrorButton({active, label, onClick}: {active: boolean; label: string; onClick: () => void}) {
  return <button className={`h-7 flex-1 rounded border text-[11px] font-semibold transition ${active ? 'border-violet-400 bg-violet-950/70 text-violet-200' : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-violet-400'}`} onClick={onClick}>{label}</button>;
}
