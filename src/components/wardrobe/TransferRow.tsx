import {Download, Upload} from 'lucide-react';
import {t} from '@/i18n/i18n';
import {Button} from '@/components/ui/Button';
import {FileInput} from '@/components/ui/Fields';

export function TransferRow({
                              label,
                              exportLabel,
                              importLabel,
                              onExport,
                              onImport,
                              onImportFile,
                              accept = 'application/json,.json',
                              disabled = false,
                            }: {
  label: string;
  exportLabel?: string;
  importLabel?: string;
  onExport: () => void;
  onImport?: () => void;
  onImportFile?: (file: File) => void;
  accept?: string;
  disabled?: boolean;
}) {
  const importText = importLabel ?? t('wardrobe-import');

  const importButton = <Button density="stage"
                               className="h-10 w-full"
                               disabled={disabled}
    // The file input above the button is what opens the picker; the button itself is only its face.
                               tabIndex={onImportFile ? -1 : undefined}
                               onClick={onImport}
                               icon={<Download className="h-5 w-5"/>}
  >{importText}</Button>;

  return <div className="flex flex-col gap-1.5">
    <span className="text-center text-[22px] text-white">{label}</span>
    <div className="flex gap-2">
      <Button density="stage"
              className="h-10 flex-1"
              disabled={disabled}
              onClick={onExport}
              icon={<Upload className="h-5 w-5"/>}
      >{exportLabel ?? t('wardrobe-export')}</Button>

      {onImportFile
        ? <FileInput className="flex-1" accept={accept} ariaLabel={importText} onSelect={onImportFile}>
          {importButton}
        </FileInput>
        : <div className="flex-1">{importButton}</div>}
    </div>
  </div>;
}
