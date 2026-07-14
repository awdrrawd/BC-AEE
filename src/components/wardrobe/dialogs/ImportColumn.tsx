import type {ReactNode} from 'react';

export function ImportColumn({title, children}: { title: string; children: ReactNode }) {
  return <section className="flex min-h-0 flex-1 flex-col gap-2">
    <h2 className="shrink-0 text-center text-[24px] text-white">{title}</h2>
    <div
      className="aee-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto rounded-xl border border-white/20 p-2">
      {children}
    </div>
  </section>;
}
