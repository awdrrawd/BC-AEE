export function BgLayerButton({active, label, onClick}: { active: boolean; label: string; onClick: () => void }) {
  return <button
    className={`flex-1 rounded border px-2 py-1 text-[10px] font-semibold ${active ? 'border-teal-300 bg-teal-400/10 text-teal-300' : 'border-zinc-700 text-zinc-400 hover:text-zinc-100'}`}
    onClick={onClick}>{label}</button>;
}
