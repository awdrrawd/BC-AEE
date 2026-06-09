export function BgModeButton({active, label, onClick}: {active: boolean; label: string; onClick: () => void}) {
  return <button className={`flex-1 rounded border px-2 py-1 text-[10px] font-semibold ${active ? 'border-violet-400 bg-violet-500/15 text-violet-300' : 'border-zinc-700 text-zinc-400 hover:text-zinc-100'}`} onClick={onClick}>{label}</button>;
}
