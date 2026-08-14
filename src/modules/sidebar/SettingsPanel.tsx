import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Printer, RotateCcw, Upload } from 'lucide-react';
import { Checkbox } from '@/components/primitives/checkbox';
import { ThemeToggle } from './atoms/ThemeToggle';

interface SettingsPanelProps {
  showFullPreviewText?: boolean;
  onSetShowFullPreviewText?: (value: boolean) => void;
  playModeSounds?: boolean;
  onSetPlayModeSounds?: (value: boolean) => void;
  onExport?: () => void;
  onImport?: (file: File) => void;
  onClearAll?: () => void;
  onClose: () => void;
  panelRef: React.RefObject<HTMLDivElement>;
}

export const SettingsPanel = ({
  showFullPreviewText,
  onSetShowFullPreviewText,
  playModeSounds,
  onSetPlayModeSounds,
  onExport,
  onImport,
  onClearAll,
  onClose: _onClose,
  panelRef,
}: SettingsPanelProps) => {
  const { t } = useTranslation('common');
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full left-0 right-0 bg-popover border-y shadow-[0_-4px_16px_rgba(0,0,0,0.08)] max-h-72 overflow-y-auto z-20"
    >
      <div className="py-2 space-y-1">
        {onSetShowFullPreviewText && (
          <div className="px-3 py-2">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={!(showFullPreviewText ?? true)}
                onCheckedChange={(checked) => {
                  const newValue = !checked as boolean;
                  onSetShowFullPreviewText(newValue);
                }}
                className="mt-0.5"
              />
              <span>{t('settings.truncateDescription')}</span>
            </label>
          </div>
        )}

        {onSetPlayModeSounds && (
          <div className="px-3 py-2">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={playModeSounds ?? false}
                onCheckedChange={(checked) => onSetPlayModeSounds(checked === true)}
                className="mt-0.5"
              />
              <span>{t('settings.playModeSounds')}</span>
            </label>
          </div>
        )}

        <ThemeToggle />

        <div className="border-t pt-1 mt-1">
          <button
            onClick={() => {
              window.print();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
          >
            <Printer className="h-4 w-4" />
            {t('settings.exportPdf')}
          </button>
          <button
            onClick={onExport}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
          >
            <Download className="h-4 w-4" />
            {t('settings.exportData')}
          </button>
          <label className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors cursor-pointer">
            <Upload className="h-4 w-4" />
            {t('settings.importData')}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onImport?.(file);
                  e.target.value = '';
                }
              }}
              className="hidden"
            />
          </label>
          <button
            onClick={onClearAll}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-destructive/10 text-destructive transition-colors font-semibold"
          >
            <RotateCcw className="h-4 w-4" />
            {t('settings.clearAll')}
          </button>
        </div>
      </div>
    </div>
  );
};
