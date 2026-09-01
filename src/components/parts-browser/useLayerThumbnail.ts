import {useEffect, useState} from 'react';
import {getLayerThumbnail} from '@/controllers/layerThumbnailController';

export function useLayerThumbnail(index: number | 'all', fallback: string, revision: unknown, max = 160) {
  const [url, setUrl] = useState(fallback);
  useEffect(() => {
    let active = true;
    let attempts = 0;
    let timer = 0;
    const load = () => {
      const thumbnail = getLayerThumbnail(index, max);
      if (thumbnail) {
        if (active) setUrl(thumbnail);
        return;
      }
      if (active && attempts++ < 20) timer = window.setTimeout(load, 100);
      else if (active) setUrl(fallback);
    };
    queueMicrotask(load);
    return () => { active = false; window.clearTimeout(timer); };
  }, [fallback, index, max, revision]);
  return url;
}
