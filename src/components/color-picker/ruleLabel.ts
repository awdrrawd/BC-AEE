import {t} from '@/i18n/i18n';

export function ruleLabel(rule: string) {
  if (rule === 'complementary') return t('color-picker-harmony-complementary-rule');
  if (rule === 'triadic') return t('color-picker-harmony-triadic-rule');
  if (rule === 'analogous') return t('color-picker-harmony-analogous-rule');
  if (rule === 'split') return t('color-picker-harmony-split-rule');
  return t('color-picker-harmony-tetradic-rule');
}
