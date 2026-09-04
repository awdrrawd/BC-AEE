import {FolderSearch} from '@/components/main-panel/icons/Icons';
import {t} from '@/i18n/i18n';

export function PartsBrowserButton({open, onClick}: {open: boolean; onClick: () => void}) {
  return <button type="button" aria-label={t('parts-browser-title')} data-aee-tooltip={t('parts-browser-title')}
    className={`flex h-[30px] w-[45px] items-center justify-center rounded border bg-(--aee-control-bg) transition ${open ? 'border-(--aee-accent) text-(--aee-accent)' : 'border-zinc-700 text-zinc-200 hover:border-(--aee-accent)'}`}
    onPointerDown={event => event.stopPropagation()} onClick={onClick}>
    <FolderSearch className="h-[25px] w-[25px]"/>
  </button>;
}
