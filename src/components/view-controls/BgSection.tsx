import type {ReactNode} from 'react';
import {Switch} from '@/components/Switch';

export function BgSection({title, enabled, onChange, children}: {
  title: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  children: ReactNode
}) {
  return <section className="overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/80">
    <div className="flex items-center justify-between border-b border-zinc-800 px-2.5 py-1.5">
      <span className="text-xs font-bold tracking-wide text-zinc-100">{title}</span>
      <Switch checked={enabled} onChange={onChange} ariaLabel={title}/>
    </div>
    <div className="flex flex-col gap-2 px-2.5 py-2">{children}</div>
  </section>;
}
