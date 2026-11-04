/**
 * usePlannerDataActions — Exchanging plan data with files and the personal
 * library: exports, imports, block library and templates.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useLibrary } from '@/contexts/LibraryContext';
import { armFeedbackValuableAction } from '@/hooks/useFeedbackPrompt';
import { buildWorkshopCsv, downloadWorkshopCsv, type CsvColumnLabels } from '@/lib/workshop-csv';
import {
  exportWorkshopAsJson,
  importWorkshopFromJson,
  parseWorkshopJson,
  saveBlockToLibrary,
  saveTemplate,
  type WorkshopTemplate,
} from '@/lib/workshopStorage';
import { withDisplayNames } from '@/lib/workshopUtils';
import type { WorkshopData, WorkshopItem } from '@/types/workshop';

interface UsePlannerDataActionsArgs {
  plan: WorkshopData;
  loadWorkshop: (data: WorkshopData) => void;
}

interface PlannerDataActions {
  handleExport: () => void;
  handleExportCsv: () => void;
  handleImport: (file: File) => Promise<void>;
  handleImportText: (text: string) => Promise<void>;
  handleSaveToLibrary: (item: WorkshopItem) => Promise<void>;
  handleLoadTemplate: (template: WorkshopTemplate) => void;
  saveTemplateDialogOpen: boolean;
  setSaveTemplateDialogOpen: (open: boolean) => void;
  templateName: string;
  setTemplateName: (name: string) => void;
  handleSaveAsTemplate: () => Promise<void>;
}

export const usePlannerDataActions = ({ plan, loadWorkshop }: UsePlannerDataActionsArgs): PlannerDataActions => {
  const { t, i18n } = useTranslation('common');
  const { refreshBlocks, refreshTemplates } = useLibrary();
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');

  return {
    handleExport: () => {
      exportWorkshopAsJson(plan);
      armFeedbackValuableAction('json-export');
      toast.success(t('planner.exportSuccess'));
    },
    handleExportCsv: () => {
      const labels: CsvColumnLabels = {
        nr: t('settings.csv.nr'),
        from: t('settings.csv.from'),
        to: t('settings.csv.to'),
        duration: t('settings.csv.duration'),
        type: t('settings.csv.type'),
        title: t('settings.csv.title'),
        breakoutGroup: t('settings.csv.breakoutGroup'),
        people: t('settings.csv.people'),
        material: t('settings.csv.material'),
        notes: t('settings.csv.notes'),
        total: t('settings.csv.total'),
        dayTotal: t('settings.csv.dayTotal'),
        day: (index) => t('days.label', { index }),
        group: t('settings.csv.group'),
        breakout: t('settings.csv.breakout'),
        block: t('settings.csv.block'),
        all: t('settings.csv.all'),
      };
      const displayed = withDisplayNames(plan, t);
      const csv = buildWorkshopCsv(displayed, labels, i18n.language === 'de' ? 'de' : 'en');
      downloadWorkshopCsv(displayed.workshop.title, csv);
      armFeedbackValuableAction('csv-export');
      toast.success(t('planner.exportSuccess'));
    },
    handleImport: async (file) => {
      try {
        loadWorkshop(await importWorkshopFromJson(file));
        toast.success(t('planner.importSuccess'));
      } catch {
        toast.error(t('planner.importFailed'));
      }
    },
    handleImportText: async (text) => {
      loadWorkshop(parseWorkshopJson(text));
      toast.success(t('planner.importSuccess'));
    },
    handleSaveToLibrary: async (item) => {
      await saveBlockToLibrary(item.title, item);
      refreshBlocks();
      toast.success(t('dialog.savedToLibrary'));
    },
    handleLoadTemplate: (template) => {
      loadWorkshop(template.data);
      toast.success(t('dialog.templateLoaded'));
    },
    saveTemplateDialogOpen,
    setSaveTemplateDialogOpen,
    templateName,
    setTemplateName,
    handleSaveAsTemplate: async () => {
      if (templateName.trim()) {
        await saveTemplate(templateName.trim(), plan);
        refreshTemplates();
        toast.success(t('dialog.templateSaved'));
        setTemplateName('');
        setSaveTemplateDialogOpen(false);
      }
    },
  };
};
