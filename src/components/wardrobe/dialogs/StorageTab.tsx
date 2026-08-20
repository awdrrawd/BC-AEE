import {ExternalLink} from 'lucide-react';
import {t} from '@/i18n/i18n';
import {settings} from '@/core/settings';
import {fbcWardrobeUsage} from '@/core/wardrobeStorage';
import {SettingRow} from '@/components/ui/SettingRow';
import {Button} from '@/components/ui/Button';

const ROW_CLASS = 'flex shrink-0 rounded-lg border border-white/8 bg-black/35 px-4';

function Gauge({label, hint, used, budget}: {label: string; hint: string; used: number; budget: number}) {
  const pct = Math.min(100, Math.round((used / budget) * 100));
  const danger = pct >= 90;
  return <div className={`${ROW_CLASS} flex-col gap-1.5 py-3`} title={hint}>
    <div className="flex items-baseline justify-between text-[22px]">
      <span className="text-[#f0eee4]">{label}</span>
      <span className={danger ? 'text-red-400' : 'text-zinc-400'}>{pct}%</span>
    </div>
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/50">
      <div className="h-full rounded-full transition-[width]"
           style={{width: `${pct}%`, background: danger ? '#f87171' : 'var(--aee-accent)'}}/>
    </div>
    <div className="text-[15px] text-zinc-500">{hint}</div>
  </div>;
}

export function StorageTab() {
  const fbc = fbcWardrobeUsage();
  return <div className="flex flex-col gap-3">
    <SettingRow label={t('wardrobe-setting-confirm-save')} setting={settings.wardrobeConfirmSave} density="stage"/>
    <SettingRow label={t('wardrobe-setting-96-slots')} setting={settings.wardrobeExtended} density="stage"
                tooltip={t('wardrobe-setting-96-slots-hint')}/>
    <SettingRow label={t('wardrobe-setting-shared')} setting={settings.wardrobeShared} density="stage"/>
    <SettingRow label={t('wardrobe-setting-sps')} setting={settings.wardrobeSpsEnabled} density="stage"/>
    <div className={`${ROW_CLASS} items-center justify-between gap-3 py-3`}>
      <div>
        <div className="text-[22px] text-[#f0eee4]">{t('wardrobe-sps-about')}</div>
        <div className="text-[15px] text-zinc-500">{t('wardrobe-sps-about-hint')}</div>
      </div>
      <div className="flex gap-2">
        <Button density="stage" icon={<ExternalLink className="h-4 w-4"/>}
                onClick={() => window.open('https://github.com/bondage-studio/studio-player-storage', '_blank', 'noopener')}>
          SPS
        </Button>
        <Button density="stage" icon={<ExternalLink className="h-4 w-4"/>}
                onClick={() => window.open('https://github.com/bondage-studio/studio-oauth', '_blank', 'noopener')}>
          OAuth
        </Button>
      </div>
    </div>
    <div className="mt-auto flex flex-col gap-3 pt-3">
      <Gauge label={t('wardrobe-capacity-label')} hint={t('wardrobe-capacity-hint')} {...fbc}/>
    </div>
  </div>;
}
