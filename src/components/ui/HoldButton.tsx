import type {ReactNode} from 'react';
import {useHoldRepeat} from '@/components/ui/useHoldRepeat';

/** A `<button>` whose action fires once on press and then repeats while held. */
export function HoldButton({onTrigger, className, children, title, ariaLabel}: {
  onTrigger: () => void;
  className?: string;
  children: ReactNode;
  title?: string;
  ariaLabel?: string;
}) {
  const handlers = useHoldRepeat(onTrigger);
  return <button type="button" className={className} title={title} aria-label={ariaLabel} {...handlers}>{children}</button>;
}
