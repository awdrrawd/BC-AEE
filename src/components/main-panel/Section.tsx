import type {ReactNode} from 'react';

export function Section({title, children}: { title?: string; children: ReactNode }) {
  return <section className="border-b border-zinc-700 px-2.5 py-2">
    {title ?
      <div className="mb-1.5 text-center text-xs font-bold uppercase tracking-wider text-zinc-100">{title}</div> : null}
    {children}
  </section>;
}
