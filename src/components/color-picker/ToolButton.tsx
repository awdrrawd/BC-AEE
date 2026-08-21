import type {ReactNode} from 'react';
import {IconButton} from '@/components/ui/Button';

export function ToolButton({title, children, onClick}: { title: string; children: ReactNode; onClick: () => void }) {
  return <IconButton className="h-11 w-11" icon={children} title={title} onClick={onClick}/>;
}
