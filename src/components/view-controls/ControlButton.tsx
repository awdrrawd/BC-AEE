import type {ReactNode} from 'react';

export function ControlButton({active, label, icon, onClick}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void
}) {

  return <button
    className={`relative flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-[8px] border bg-zinc-900/90 text-zinc-200 transition ${active
      ? '[border-width:2.5px] border-(--aee-accent) text-(--aee-accent) shadow-[0_0_9px_var(--aee-accent-55)]'
      : 'border-zinc-700 hover:[border-width:2.5px] hover:border-(--aee-accent) hover:bg-(--aee-accent-35) hover:text-white hover:shadow-[0_0_9px_var(--aee-accent-55)]'}`}
    data-aee-tooltip={label} data-aee-tooltip-placement="top" aria-label={label} onClick={onClick}>
    <span className="pointer-events-none flex h-[34px] w-[34px] items-center justify-center [&_svg]:h-full [&_svg]:w-full">{icon}</span>
  </button>;
}
