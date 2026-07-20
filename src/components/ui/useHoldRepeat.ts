import {type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef} from 'react';

// Delay before a held button starts auto-repeating, and the gap between repeats after that.
const HOLD_DELAY = 400;
const HOLD_INTERVAL = 60;

/**
 * Turns a plain step action into a hold-to-repeat one: fires once on press, then keeps
 * firing while the pointer stays down so users don't have to click +1/-1 dozens of times.
 * Returns pointer handlers to spread onto a button (replacing its `onClick`).
 */
export function useHoldRepeat(action: () => void) {
  const actionRef = useRef(action);
  actionRef.current = action;
  const timers = useRef<{timeout?: ReturnType<typeof setTimeout>; interval?: ReturnType<typeof setInterval>}>({});

  const stop = useCallback(() => {
    if (timers.current.timeout !== undefined) clearTimeout(timers.current.timeout);
    if (timers.current.interval !== undefined) clearInterval(timers.current.interval);
    timers.current = {};
  }, []);

  // Clear any pending timers if the button unmounts mid-hold.
  useEffect(() => stop, [stop]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return; // primary button / touch only
    event.stopPropagation(); // steppers sit inside draggable panels — don't start a drag
    actionRef.current();
    timers.current.timeout = setTimeout(() => {
      timers.current.interval = setInterval(() => actionRef.current(), HOLD_INTERVAL);
    }, HOLD_DELAY);
  }, []);

  return {onPointerDown, onPointerUp: stop, onPointerLeave: stop, onPointerCancel: stop};
}
