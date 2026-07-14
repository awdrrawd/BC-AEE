import {ruleLabel} from '@/components/color-picker/ruleLabel';
import {Button} from '@/components/ui/Button';

export function HarmonyRuleButton({name, active, onClick}: { name: string; active: boolean; onClick: () => void }) {
  return <Button
    className="min-h-0 rounded-full px-2 py-0.5 text-[11px]"
    selected={active}
    onClick={onClick}>
    {ruleLabel(name)}
  </Button>;
}
