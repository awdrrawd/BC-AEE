export function ColorChipButton({color, size, onClick}: { color: string; size: 'sm' | 'md'; onClick: () => void }) {
  const sizeClass = size === 'md' ? 'h-8 w-8' : 'h-7 w-7';
  return <button
    className={`relative ${sizeClass} overflow-hidden rounded border border-zinc-700 bg-[repeating-conic-gradient(#222_0%_25%,#111_0%_50%)] bg-[length:6px_6px]`}
    onClick={onClick}>
    <span className="absolute inset-0" style={{background: color}}/>
  </button>;
}
