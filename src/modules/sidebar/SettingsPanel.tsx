import { Button } from '@/components/primitives/button';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileSpreadsheet, Keyboard, MessageSquare, Printer, RotateCcw, Sparkles, Upload } from 'lucide-react';
import { Switch } from '@/components/primitives/switch';
import { ThemeToggle } from './atoms/ThemeToggle';
import { armFeedbackValuableAction } from '@/hooks/useFeedbackPrompt';

interface SettingsPanelProps {
  showFullPreviewText?: boolean;
  onSetShowFullPreviewText?: (value: boolean) => void;
  playModeSounds?: boolean;
  onSetPlayModeSounds?: (value: boolean) => void;
  timeVisualizationStrip?: boolean;
  onSetTimeVisualizationStrip?: (value: boolean) => void;
  onExport?: () => void;
  onExportCsv?: () => void;
  onImport?: (file: File) => void;
  onClearAll?: () => void;
  onOpenAiHelp?: () => void;
  /** Open the optional feedback dialog (always available; bypasses locks). */
  onOpenFeedback?: () => void;
  onOpenKeyboardShortcuts?: () => void;
  panelRef: React.RefObject<HTMLDivElement>;
}

export const SettingsPanel = ({
  showFullPreviewText,
  onSetShowFullPreviewText,
  playModeSounds,
  onSetPlayModeSounds,
  timeVisualizationStrip,
  onSetTimeVisualizationStrip,
  onExport,
  onExportCsv,
  onImport,
  onClearAll,
  onOpenAiHelp,
  onOpenFeedback,
  onOpenKeyboardShortcuts,
  panelRef,
}: SettingsPanelProps) => {
  const { t } = useTranslation('common');
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full left-0 right-0 bg-popover border-y shadow-[0_-4px_16px_rgba(0,0,0,0.08)] overflow-y-auto z-20"
    >
      <div className="py-2 space-y-1">
        {onSetTimeVisualizationStrip && (
          <div className="px-3 py-2 flex items-center justify-between gap-3">
            <label htmlFor="time-visualization-strip-toggle" className="text-sm cursor-pointer">
              {t('settings.timeVisualizationStrip')}
            </label>
            <Switch
              id="time-visualization-strip-toggle"
              checked={timeVisualizationStrip ?? false}
              onCheckedChange={(checked) => onSetTimeVisualizationStrip(checked)}
            />
          </div>
        )}

        {onSetShowFullPreviewText && (
          <div className="px-3 py-2 flex items-center justify-between gap-3">
            <label htmlFor="truncate-description-toggle" className="text-sm cursor-pointer">
              {t('settings.truncateDescription')}
            </label>
            <Switch
              id="truncate-description-toggle"
              checked={!(showFullPreviewText ?? true)}
              onCheckedChange={(checked) => {
                const newValue = !checked;
                onSetShowFullPreviewText(newValue);
              }}
            />
          </div>
        )}

        {onSetPlayModeSounds && (
          <div className="px-3 py-2 flex items-center justify-between gap-3">
            <label htmlFor="play-mode-sounds-toggle" className="text-sm cursor-pointer">
              {t('settings.playModeSounds')}
            </label>
            <Switch
              id="play-mode-sounds-toggle"
              checked={playModeSounds ?? false}
              onCheckedChange={(checked) => onSetPlayModeSounds(checked)}
            />
          </div>
        )}

        <ThemeToggle />

        <div className="border-t pt-1 mt-1">
          <Button variant="plain" size="none"
            onClick={() => {
              armFeedbackValuableAction('print');
              window.print();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
          >
            <Printer className="h-4 w-4" />
            {t('settings.exportPdf')}
          </Button>
          {onExportCsv && (
            <Button variant="plain" size="none"
              onClick={onExportCsv}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {t('settings.exportCsv')}
            </Button>
          )}
          {onOpenFeedback && (
            <Button variant="plain" size="none"
              onClick={onOpenFeedback}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              {t('feedback.give')}
            </Button>
          )}
          {onOpenKeyboardShortcuts && (
            <Button variant="plain" size="none"
              onClick={onOpenKeyboardShortcuts}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors [@media(pointer:coarse)]:hidden"
            >
              <Keyboard className="h-4 w-4" />
              {t('shortcuts.title')}
            </Button>
          )}
          {onOpenAiHelp && (
            <Button variant="plain" size="none"
              onClick={() => {
                onOpenAiHelp();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              {t('settings.aiHelp')}
            </Button>
          )}
          <Button variant="plain" size="none"
            onClick={onExport}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
          >
            <Download className="h-4 w-4" />
            {t('settings.exportData')}
          </Button>
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
          <Button variant="plain" size="none"
            onClick={onClearAll}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-destructive/10 text-destructive-text transition-colors font-semibold"
          >
            <RotateCcw className="h-4 w-4" />
            {t('settings.clearAll')}
          </Button>
        </div>
      </div>
    </div>
  );
};
