import {t} from '@/i18n/i18n';

export function AboutAee() {
  return <div className="p-4 text-left text-xs leading-6" style={{color: 'oklch(0.88 0 0)'}}>
    <b className="block text-center text-white">{t('about-title')}</b><br/>
    • {t('about-line-opacity-offset')}<br/>
    • {t('about-line-experimental')}<br/>
    • {t('about-line-customizable')}<br/>
    • {t('about-line-feedback')} <a
    href="https://github.com/awdrrawd/BC-AEE"
    target="_blank"
    rel="noopener noreferrer"
    className="text-(--aee-accent) underline hover:text-(--aee-accent)"
    onClick={e => e.stopPropagation()}>
    GitHub
  </a>
  </div>;
}
