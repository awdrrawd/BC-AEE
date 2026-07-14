import type {ReactNode} from 'react';
import {IconButton} from '@/components/ui/Button';

export function ToolButton({title, children, onClick}: { title: string; children: ReactNode; onClick: () => void }) {
  return <IconButton className="h-8 w-8" icon={children} title={title} onClick={onClick}/>;
}
