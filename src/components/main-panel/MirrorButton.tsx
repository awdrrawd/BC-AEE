import {Button} from '@/components/ui/Button';

export function MirrorButton({active, label, onClick}: { active: boolean; label: string; onClick: () => void }) {
  return <Button className="h-7 flex-1 text-[11px] font-semibold" selected={active} onClick={onClick}>{label}</Button>;
}
