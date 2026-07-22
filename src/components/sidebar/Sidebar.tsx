import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BlockType, WorkshopItem, Person } from '@/types/workshop';
import {
  deleteBlockFromLibrary,
  deleteTemplate,
  WorkshopTemplate,
  BlockTemplate,
} from '@/lib/workshopStorage';
import { useLibrary } from '@/contexts/LibraryContext';
import { useSidebarSections } from '@/hooks/useSidebarSections';
import { useLanguageSwitcher } from '@/hooks/useLanguageSwitcher';
import { useIsLg } from '@/hooks/use-lg';
import { cn } from '@/lib/utils';
import { DEFAULT_TYPE_COLOR, DEFAULT_PERSON_COLOR } from '@/lib/workshopDefaults';
import { BlockTypesSection } from './BlockTypesSection';
import { PersonsSection } from './PersonsSection';
import { LibrarySection, TemplatesSection } from './LibraryAndTemplatesSection';
import { CollapsedView } from './CollapsedView';
import { SettingsPanel } from './SettingsPanel';
import { SidebarBottomBar, SidebarLogo, MobileCloseButton } from './SidebarBottomBar';
import { SidebarDialogs } from './SidebarDialogs';

interface SidebarProps {
  blockTypes: BlockType[];
  persons: Person[];
  onAddBlock: (blockTypeId: string) => void;
  onAddGroup: () => void;
  onAddBreakout: () => void;
  onAddFromLibrary: (item: WorkshopItem) => void;
  onLoadTemplate: (template: WorkshopTemplate) => void;
  onAddBlockType: (blockType: Omit<BlockType, 'id'>) => void;
  onUpdateBlockType: (id: string, updates: Partial<Omit<BlockType, 'id'>>) => void;
  onDeleteBlockType: (id: string) => void;
  onAddPerson: (person: Omit<Person, 'id'>) => void;
  onUpdatePerson: (id: string, updates: Partial<Omit<Person, 'id'>>) => void;
  onDeletePerson: (id: string) => void;
  showFullPreviewText?: boolean;
  onSetShowFullPreviewText?: (value: boolean) => void;
  onExport?: () => void;
  onImport?: (file: File) => void;
  onReset?: () => void;
  onClearAll?: () => void;
  onSaveAsTemplate?: () => void;
  itemsCount?: number;
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar = ({
  blockTypes,
  persons,
  onAddBlock,
  onAddGroup,
  onAddBreakout,
  onAddFromLibrary,
  onLoadTemplate,
  onAddBlockType,
  onUpdateBlockType,
  onDeleteBlockType,
  onAddPerson,
  onUpdatePerson,
  onDeletePerson,
  showFullPreviewText,
  onSetShowFullPreviewText,
  onExport,
  onImport,
  onReset: _onReset,
  onClearAll,
  onSaveAsTemplate,
  itemsCount: _itemsCount = 0,
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapse,
}: SidebarProps) => {
  const {
    blocks: library,
    templates,
    isLoadingBlocks,
    isLoadingTemplates,
    refreshBlocks,
    refreshTemplates,
  } = useLibrary();

  const { expandedSections, toggleSection, openSection, closeSection } = useSidebarSections({
    onLibraryOpen: refreshBlocks,
    onTemplatesOpen: refreshTemplates,
  });

  const { locale, getTargetUrl } = useLanguageSwitcher();
  const { t: _t } = useTranslation('common');
  const navigate = useNavigate();

  const isLg = useIsLg();
  const collapsed = isCollapsed && isLg;

  const [newTypeColor, setNewTypeColor] = useState(DEFAULT_TYPE_COLOR);
  const [showNewTypeForm, setShowNewTypeForm] = useState(false);
  const [newPersonColor, setNewPersonColor] = useState(DEFAULT_PERSON_COLOR);
  const [showNewPersonForm, setShowNewPersonForm] = useState(false);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [editingBlockTypeId, setEditingBlockTypeId] = useState<string | null>(null);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<
    { kind: 'blockType' | 'person'; id: string; name: string } | null
  >(null);

  const settingsRef = useRef<HTMLDivElement>(null);

  const handleSectionClick = useCallback(
    (section: keyof typeof expandedSections) => {
      if (isCollapsed) {
        onToggleCollapse();
        openSection(section);
      } else {
        toggleSection(section);
      }
    },
    [isCollapsed, onToggleCollapse, toggleSection, openSection],
  );

  const handleAddNewType = useCallback(
    (name: string, color: string) => {
      onAddBlockType({ name, color });
      setShowNewTypeForm(false);
    },
    [onAddBlockType],
  );

  const handleAddNewPerson = useCallback(
    (name: string, color: string) => {
      onAddPerson({ name, color });
      setShowNewPersonForm(false);
    },
    [onAddPerson],
  );

  const handleSaveBlockType = useCallback(
    (id: string, name: string, color: string) => {
      onUpdateBlockType(id, { name, color });
      setEditingBlockTypeId(null);
    },
    [onUpdateBlockType],
  );

  const handleSavePerson = useCallback(
    (id: string, name: string, color: string) => {
      onUpdatePerson(id, { name, color });
      setEditingPersonId(null);
    },
    [onUpdatePerson],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === 'blockType') {
      onDeleteBlockType(pendingDelete.id);
      setEditingBlockTypeId(null);
    } else {
      onDeletePerson(pendingDelete.id);
      setEditingPersonId(null);
    }
    setPendingDelete(null);
  }, [pendingDelete, onDeleteBlockType, onDeletePerson]);

  const handleDeleteLibraryItem = useCallback(
    async (id: string) => {
      await deleteBlockFromLibrary(id);
      refreshBlocks();
    },
    [refreshBlocks],
  );

  const handleDeleteTemplate = useCallback(
    async (id: string) => {
      await deleteTemplate(id);
      refreshTemplates();
    },
    [refreshTemplates],
  );

  useEffect(() => {
    if (!expandedSections.settings) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        closeSection('settings');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expandedSections.settings, closeSection]);

  const sidebarRef = useRef<HTMLElement>(null);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        ref={sidebarRef}
        className={cn(
          'fixed left-0 p-0 z-50',
          'bg-sidebar/85 backdrop-blur-md border-r lg:border lg:rounded-r-2xl shadow-sm',
          'transform transition-all duration-200 ease-out',
          'flex flex-col overflow-hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          collapsed
            ? 'top-1/2 -translate-y-1/2 h-auto w-16'
            : 'top-0 h-dvh w-72 lg:top-3 lg:h-[calc(100dvh-1.5rem)]',
        )}
      >
        {!collapsed && <SidebarLogo onCollapse={onToggleCollapse} />}
        {!collapsed && (
          <MobileCloseButton onClose={onClose} />
        )}

        <div
          className={cn(
            collapsed ? 'flex flex-col' : 'flex-1 overflow-y-auto scrollbar-thin flex flex-col',
            'relative',
          )}
        >
          {expandedSections.settings && !collapsed && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] z-10" />
          )}

          {collapsed ? (
            <CollapsedView
              blockTypes={blockTypes}
              onAddBlock={onAddBlock}
              onAddGroup={onAddGroup}
              onAddBreakout={onAddBreakout}
              onExpand={onToggleCollapse}
            />
          ) : (
            <>
              <BlockTypesSection
                blockTypes={blockTypes}
                isOpen={expandedSections.blockTypes}
                onToggle={() => handleSectionClick('blockTypes')}
                onAddBlock={onAddBlock}
                onAddGroup={onAddGroup}
                onAddBreakout={onAddBreakout}
                onAddBlockType={handleAddNewType}
                editingBlockTypeId={editingBlockTypeId}
                onStartEditBlockType={(id) =>
                  setEditingBlockTypeId((curr) => (curr === id ? null : id))
                }
                onUpdateBlockType={handleSaveBlockType}
                onRequestDeleteBlockType={(id, name) =>
                  setPendingDelete({ kind: 'blockType', id, name })
                }
                showNewTypeForm={showNewTypeForm}
                newTypeColor={newTypeColor}
                onShowNewTypeForm={() => setShowNewTypeForm(true)}
                onHideNewTypeForm={() => {
                  setShowNewTypeForm(false);
                  setNewTypeColor(DEFAULT_TYPE_COLOR);
                }}
              />

              <PersonsSection
                persons={persons}
                isOpen={expandedSections.persons}
                onToggle={() => handleSectionClick('persons')}
                onAddPerson={handleAddNewPerson}
                editingPersonId={editingPersonId}
                onStartEditPerson={(id) =>
                  setEditingPersonId((curr) => (curr === id ? null : id))
                }
                onUpdatePerson={handleSavePerson}
                onRequestDeletePerson={(id, name) =>
                  setPendingDelete({ kind: 'person', id, name })
                }
                showNewPersonForm={showNewPersonForm}
                newPersonColor={newPersonColor}
                onShowNewPersonForm={() => setShowNewPersonForm(true)}
                onHideNewPersonForm={() => {
                  setShowNewPersonForm(false);
                  setNewPersonColor(DEFAULT_PERSON_COLOR);
                }}
              />

              <LibrarySection
                library={library as BlockTemplate[]}
                isLoading={isLoadingBlocks}
                isOpen={expandedSections.library}
                onToggle={() => handleSectionClick('library')}
                onAddFromLibrary={onAddFromLibrary}
                onDeleteLibraryItem={handleDeleteLibraryItem}
              />

              <TemplatesSection
                templates={templates}
                isLoading={isLoadingTemplates}
                isOpen={expandedSections.templates}
                onToggle={() => handleSectionClick('templates')}
                onLoadTemplate={onLoadTemplate}
                onDeleteTemplate={handleDeleteTemplate}
                onSaveAsTemplate={onSaveAsTemplate}
              />
            </>
          )}
        </div>

        <div
          ref={settingsRef}
          className={cn(
            'flex-shrink-0 relative pb-[env(safe-area-inset-bottom)]',
            !collapsed ? 'border-t bg-muted/40' : 'border-t',
          )}
        >
          {expandedSections.settings && !collapsed && (
            <SettingsPanel
              showFullPreviewText={showFullPreviewText}
              onSetShowFullPreviewText={onSetShowFullPreviewText}
              onExport={onExport}
              onImport={onImport}
              onClearAll={() => setShowClearAllDialog(true)}
              onClose={() => closeSection('settings')}
              panelRef={settingsRef}
            />
          )}
          <SidebarBottomBar
            isCollapsed={collapsed}
            locale={locale}
            isSettingsOpen={expandedSections.settings}
            getTargetUrl={(target) => {
              if (collapsed) {
                navigate(getTargetUrl(target));
                return '';
              }
              return getTargetUrl(target);
            }}
            onToggleSettings={() => handleSectionClick('settings')}
          />
        </div>
      </aside>

      <SidebarDialogs
        showClearAllDialog={showClearAllDialog}
        onShowClearAllDialogChange={setShowClearAllDialog}
        onClearAll={() => {
          onClearAll?.();
          setShowClearAllDialog(false);
        }}
        pendingDelete={pendingDelete}
        onClearPendingDelete={() => setPendingDelete(null)}
        onConfirmDelete={handleConfirmDelete}
      />
    </>
  );
};
