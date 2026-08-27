export function MirrorButton({active, label, onClick}: { active: boolean; label: string; onClick: () => void }) {
  return <button className={`h-5 shrink-0 rounded border px-1.5 text-[11px] transition ${active
    ? 'border-teal-300 text-teal-300'
    : 'border-zinc-700 text-zinc-400 hover:border-teal-300 hover:text-teal-300'}`}
                 onClick={onClick}>{label}</button>;
}
