import {Button} from '@/components/ui/Button';
import {useHoldRepeat} from '@/components/ui/useHoldRepeat';

export function StepPair({display, onStep}: { display: string; onStep: (delta: number) => void }) {
  const dec = useHoldRepeat(() => onStep(-1));
  const inc = useHoldRepeat(() => onStep(1));
  return <div className="flex items-center gap-1">
    <Button
      className="h-5 min-h-0 px-1.5 text-[11px]"
      {...dec}>−1
    </Button>
    <span className="min-w-9 text-center font-mono text-xs text-teal-300">{display}</span>
    <Button
      className="h-5 min-h-0 px-1.5 text-[11px]"
      {...inc}>+1
    </Button>
  </div>;
}
