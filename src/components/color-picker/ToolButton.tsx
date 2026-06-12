import type {ReactNode} from 'react';

export function ToolButton({title, children, onClick}: { title: string; children: ReactNode; onClick: () => void }) {
  return <button
    className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 text-sm text-zinc-400 hover:border-violet-400 hover:bg-zinc-900 hover:text-violet-300"
    title={title} onClick={onClick}>{children}</button>;
}
