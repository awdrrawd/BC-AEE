import {useEffect, useState} from 'react';

interface TooltipState {
  text: string;
  left: number;
  top: number;
  placement: 'right' | 'top';
}

export function AeeTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    const show = (event: PointerEvent | FocusEvent) => {
      const element = event.composedPath().find(node => node instanceof HTMLElement && node.dataset.aeeTooltip) as HTMLElement | undefined;
      if (!element?.dataset.aeeTooltip) return;
      const rect = element.getBoundingClientRect();
      const placement = element.dataset.aeeTooltipPlacement === 'top' ? 'top' : 'right';
      setTooltip({
        text: element.dataset.aeeTooltip,
        placement,
        left: placement === 'top' ? rect.left + rect.width / 2 : rect.right + 8,
        top: placement === 'top' ? rect.top - 8 : rect.top + rect.height / 2,
      });
    };
    const hide = () => setTooltip(null);
    document.addEventListener('pointerover', show, true);
    document.addEventListener('pointerout', hide, true);
    document.addEventListener('focusin', show, true);
    document.addEventListener('focusout', hide, true);
    return () => {
      document.removeEventListener('pointerover', show, true);
      document.removeEventListener('pointerout', hide, true);
      document.removeEventListener('focusin', show, true);
      document.removeEventListener('focusout', hide, true);
    };
  }, []);

  if (!tooltip) return null;
  return <div className="pointer-events-none fixed z-1000100 max-w-60 rounded-md border border-(--aee-accent) bg-(--aee-control-bg) px-2 py-1.5 text-xs font-normal leading-[1.35] text-white shadow-xl"
              style={{left: tooltip.left, top: tooltip.top, transform: tooltip.placement === 'top' ? 'translate(-50%, -100%)' : 'translateY(-50%)'}}>
    {tooltip.text}
  </div>;
}
