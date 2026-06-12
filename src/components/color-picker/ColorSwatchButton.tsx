export function ColorSwatchButton({color, className, label, onClick}: {
  color: string;
  className: string;
  label?: string;
  onClick: () => void
}) {
  return <button className={className} style={{background: color}} onClick={onClick}>
    {label ? <span
      className="absolute inset-x-0 bottom-0 text-center font-mono text-[9px] text-white opacity-0 shadow-black [text-shadow:0_1px_2px_rgba(0,0,0,.8)] group-hover:opacity-100">{label}</span> : null}
  </button>;
}
