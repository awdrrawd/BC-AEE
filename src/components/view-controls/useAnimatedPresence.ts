import {useEffect, useState} from 'react';

export function useAnimatedPresence(open: boolean, duration = 250) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    const timer = window.setTimeout(() => setMounted(false), duration);
    return () => window.clearTimeout(timer);
  }, [duration, mounted, open]);
  return {mounted, closing: mounted && !open};
}
