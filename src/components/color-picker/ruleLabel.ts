import {t} from '@/core/lang';

export function ruleLabel(rule: string) {
  if (rule === 'complementary') return t('harmCompl');
  if (rule === 'triadic') return t('harmTriadic');
  if (rule === 'analogous') return t('harmAnalog');
  if (rule === 'split') return t('harmSplit');
  return t('harmTetr');
}
