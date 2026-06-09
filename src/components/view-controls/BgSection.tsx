import type {ReactNode} from 'react';
import {isZh} from '../../core/lang';
import {SmallToggleButton} from './SmallToggleButton';

export function BgSection({title, enabled, onToggle, children}: {title: string; enabled: boolean; onToggle: () => void; children: ReactNode}) {
  return <section className="overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900/80">
    <div className="flex items-center justify-between border-b border-zinc-800 px-2.5 py-1.5">
      <span className="text-xs font-bold tracking-wide text-zinc-100">{title}</span>
      <div className="flex items-center gap-2 text-[11px] text-zinc-400">
        <SmallToggleButton enabled={enabled} onClick={onToggle}/>
        <span>{enabled ? (isZh() ? '啟用' : 'ON') : (isZh() ? '停用' : 'OFF')}</span>
      </div>
    </div>
    <div className="flex flex-col gap-2 px-2.5 py-2">{children}</div>
  </section>;
}
