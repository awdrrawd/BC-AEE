import {useEffect, useState} from 'react';
import {settings, useSetting} from '@/core/settings';

// In portrait the stage renders against a fixed virtual width (like the 2000px landscape canvas),
// with the virtual height derived from the real viewport aspect so vertical space flexes per device.
export const PORTRAIT_BASE_WIDTH = 1000;

function viewportIsPortrait(): boolean {
  return typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
}

/**
 * Whether the vertical wardrobe layout is active right now: the "support portrait" setting is on
 * AND the viewport is taller than wide. Pure/synchronous so non-React controllers (grid sizing) can call it.
 */
export function isPortraitActive(): boolean {
  return settings.wardrobePortrait.get() && viewportIsPortrait();
}

export interface Viewport {
  width: number;
  height: number;
  portrait: boolean;
}

/** Re-renders on viewport resize / orientation change and when the "support portrait" setting toggles. */
export function useViewport(): Viewport {
  const enabled = useSetting(settings.wardrobePortrait);
  const [size, setSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  }));

  useEffect(() => {
    const onResize = () => setSize({width: window.innerWidth, height: window.innerHeight});
    onResize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return {width: size.width, height: size.height, portrait: enabled && size.height > size.width};
}
