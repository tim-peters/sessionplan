import { Library, FileText, Save, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { WorkshopTemplate, BlockTemplate } from '@/lib/workshopStorage';
import { SidebarSectionHeader } from './SidebarSectionHeader';
import { DraggableLibraryItem } from './DraggableLibraryItem';

interface LibraryPanelProps {
  library: BlockTemplate[];
  isLoading: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onAddFromLibrary: (item: BlockTemplate['item']) => void;
  onDeleteLibraryItem: (id: string) => void;
}

export const LibraryPanel = ({
  library,
  isLoading,
  isOpen,
  onToggle,
  onAddFromLibrary,
  onDeleteLibraryItem,
}: LibraryPanelProps) => {
  const { t } = useTranslation('common');

  return (
    <>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide ml-1 mt-4 mb-1 px-3 pt-3">
        {t('sidebar.library')}
      </p>
      <div className="p-4">
        <SidebarSectionHeader
          icon={Library}
          label={
            <>
              {t('sidebar.blockTemplates')}
              {library.length > 0 && (
                <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  {library.length}
                </span>
              )}
            </>
          }
          isOpen={isOpen}
          onClick={onToggle}
        />

        {isOpen && (
          <div className="sidebar-section">
            {isLoading ? (
              <p className="text-sm text-muted-foreground px-3 py-2">
                {t('settings.loading')}
              </p>
            ) : library.length === 0 ? (
              <p className="text-sm text-muted-foreground px-3 py-2">
                {t('settings.noTemplates')}
              </p>
            ) : (
              library.map((block) => (
                <DraggableLibraryItem
                  key={block.id}
                  block={block}
                  onDelete={() => onDeleteLibraryItem(block.id)}
                  onAdd={() => onAddFromLibrary(block.item)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
};

interface TemplatesPanelProps {
  templates: WorkshopTemplate[];
  isLoading: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onLoadTemplate: (template: WorkshopTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onSaveAsTemplate?: () => void;
}

export const TemplatesPanel = ({
  templates,
  isLoading,
  isOpen,
  onToggle,
  onLoadTemplate,
  onDeleteTemplate,
  onSaveAsTemplate,
}: TemplatesPanelProps) => {
  const { t } = useTranslation('common');

  return (
    <div className="p-4">
      <SidebarSectionHeader
        icon={FileText}
        label={
          <>
            {t('sidebar.sessionTemplates')}
            {templates.length > 0 && (
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {templates.length}
              </span>
            )}
          </>
        }
        isOpen={isOpen}
        onClick={onToggle}
      />

      {isOpen && (
        <div className="sidebar-section">
          {isLoading ? (
            <p className="text-sm text-muted-foreground px-3 py-2">
              {t('settings.loading')}
            </p>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground px-3 py-2">
              {t('settings.noTemplates')}
            </p>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className="sidebar-item group"
                onClick={() => onLoadTemplate(template)}
              >
                <span className="flex-1 truncate">{template.name}</span>
                {template.isDefault ? (
                  <span className="h-3.5 w-3.5 text-muted-foreground/60" />
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTemplate(template.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity"
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </button>
                )}
              </div>
            ))
          )}
          {onSaveAsTemplate && (
            <button
              onClick={onSaveAsTemplate}
              className="sidebar-item text-muted-foreground hover:text-foreground"
            >
              <Save className="h-4 w-4" />
              <span>{t('dialog.saveAsTemplate')}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
