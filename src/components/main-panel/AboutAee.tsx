import {t} from '@/i18n/i18n';

export function AboutAee() {
  return <div className="p-4 text-left text-xs leading-6 text-zinc-500">
    <b className="block text-center text-white">{t('about-title')}</b><br/>
    • {t('about-line-opacity-offset')}<br/>
    • {t('about-line-experimental')}<br/>
    • {t('about-line-customizable')}<br/>
    • {t('about-line-feedback')}
  </div>;
}
