import type {ReactNode} from 'react';

export function Section({title, action, children}: { title?: string; action?: ReactNode; children: ReactNode }) {
  return <section className="border-b border-zinc-700 px-2.5 py-2">
    {title ?
      <div className="relative mb-1.5 flex min-h-7 items-center justify-center text-center text-xs font-bold uppercase tracking-wider text-zinc-100">
        {title}
        {action ? <div className="absolute right-0 flex items-center">{action}</div> : null}
      </div> : null}
    {children}
  </section>;
}
