import {type ReactNode, useEffect, useState} from 'react';
import '@/i18n/flags-engine.js';

type Flags = {ensure(country: string): Promise<string>};

// React owns both fallback and image; no external DOM replacement during reconciliation.
export function CountryLabel({label}: {label: ReactNode}) {
  const text = typeof label === 'string' ? label : '';
  const match = text.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
  const country = match ? [...match[0]].map(c => String.fromCharCode(c.codePointAt(0)! - 0x1F1E6 + 97)).join('') : '';
  const [loaded, setLoaded] = useState<{country: string; url: string} | null>(null);
  const [failed, setFailed] = useState('');
  useEffect(() => {
    let active = true;
    setFailed('');
    const flags = window.Liko?.__Sys_Flags__ as Flags | undefined;
    if (country && flags) flags.ensure(country).then(url => {
      const probe = new Image();
      probe.onload = () => { if (active) setLoaded({country, url}); };
      probe.src = url;
    }).catch(() => {});
    return () => { active = false; };
  }, [country]);
  if (!match || loaded?.country !== country || failed === country) return <>{label}</>;
  return <>{text.slice(0, match.index)}<img src={loaded.url} alt="" onError={() => setFailed(country)}
    style={{display: 'inline-block', width: '1.33em', height: '1em', verticalAlign: '-0.12em', objectFit: 'cover'}}/>{text.slice(match.index! + match[0].length)}</>;
}
