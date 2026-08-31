import {useEffect, useRef, useState} from 'react';

interface TooltipState {
  text: string;
  left: number;
  top: number;
  placement: 'right' | 'top';
}

const TOOLTIP_DELAY_MS = 500;

export function AeeTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const activeElement = useRef<HTMLElement | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    };
    const elementFromEvent = (event: Event) => event.composedPath()
      .find(node => node instanceof HTMLElement && node.dataset.aeeTooltip) as HTMLElement | undefined;
    const hide = () => {
      clearTimer();
      activeElement.current = null;
      setTooltip(null);
    };
    const schedule = (element: HTMLElement) => {
      if (activeElement.current === element) return;
      clearTimer();
      activeElement.current = element;
      setTooltip(null);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        if (activeElement.current !== element || !element.isConnected || !element.dataset.aeeTooltip) return;
        const rect = element.getBoundingClientRect();
        const placement = element.dataset.aeeTooltipPlacement === 'top' ? 'top' : 'right';
        setTooltip({
          text: element.dataset.aeeTooltip,
          placement,
          left: placement === 'top' ? rect.left + rect.width / 2 : rect.right + 8,
          top: placement === 'top' ? rect.top - 8 : rect.top + rect.height / 2,
        });
      }, TOOLTIP_DELAY_MS);
    };
    const moved = (event: PointerEvent) => {
      const element = elementFromEvent(event);
      if (element) schedule(element);
      else if (activeElement.current) hide();
    };
    const focused = (event: FocusEvent) => {
      const element = elementFromEvent(event);
      if (element?.matches(':focus-visible')) schedule(element);
    };
    const blurred = (event: FocusEvent) => {
      if (elementFromEvent(event) === activeElement.current) hide();
    };
    const leftWindow = (event: PointerEvent) => {
      if (event.relatedTarget === null) hide();
    };
    window.addEventListener('pointermove', moved, true);
    window.addEventListener('pointerout', leftWindow, true);
    window.addEventListener('blur', hide);
    window.addEventListener('focusin', focused, true);
    window.addEventListener('focusout', blurred, true);
    return () => {
      clearTimer();
      window.removeEventListener('pointermove', moved, true);
      window.removeEventListener('pointerout', leftWindow, true);
      window.removeEventListener('blur', hide);
      window.removeEventListener('focusin', focused, true);
      window.removeEventListener('focusout', blurred, true);
    };
  }, []);

  if (!tooltip) return null;
  return <div className="pointer-events-none fixed z-1000100 max-w-60 rounded-md border border-(--aee-accent) bg-(--aee-control-bg) px-2 py-1.5 text-xs font-normal leading-[1.35] text-white shadow-xl"
              style={{left: tooltip.left, top: tooltip.top, transform: tooltip.placement === 'top' ? 'translate(-50%, -100%)' : 'translateY(-50%)'}}>
    {tooltip.text}
  </div>;
}
