import {ChevronDown, ChevronLeft, ChevronRight, ChevronUp} from 'lucide-react';
import {IconButton} from '@/components/ui/Button';

type Direction = 'up' | 'down' | 'left' | 'right';

const CHEVRONS = {up: ChevronUp, down: ChevronDown, left: ChevronLeft, right: ChevronRight};

export function DirectionButton({direction, onClick}: { direction: Direction; onClick: () => void }) {
  const Chevron = CHEVRONS[direction];
  return <IconButton className="h-6 w-6" icon={<Chevron className="h-3 w-3"/>}
                     aria-label={direction} onClick={onClick}/>;
}