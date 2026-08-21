import {ruleLabel} from '@/components/color-picker/ruleLabel';
import {Button} from '@/components/ui/Button';

export function HarmonyRuleButton({name, active, onClick}: { name: string; active: boolean; onClick: () => void }) {
  return <Button
    className="min-h-9 rounded-full px-3 py-1 text-[17px]"
    selected={active}
    onClick={onClick}>
    {ruleLabel(name)}
  </Button>;
}
