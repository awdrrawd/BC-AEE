import {useEffect, type RefObject} from 'react';

/** A native non-passive listener also prevents the surrounding panel scrolling. */
export function useRangeWheel(ref: RefObject<HTMLInputElement | null>, onChange: (value: number) => void) {
  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    const wheel = (event: WheelEvent) => {
      if (input.disabled || event.ctrlKey || !event.deltaY) return;
      event.preventDefault();
      event.stopPropagation();
      const previous = input.value;
      if (event.deltaY < 0) input.stepUp();
      else input.stepDown();
      if (input.value !== previous) onChange(input.valueAsNumber);
    };
    input.addEventListener('wheel', wheel, {passive: false});
    return () => input.removeEventListener('wheel', wheel);
  }, [ref, onChange]);
}
