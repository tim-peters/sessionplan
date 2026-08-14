/**
 * WorkshopPlanner — Top-level planner container component.
 *
 * Role: Orchestrates the entire workshop planning UI. Owns the DndContext
 *       (drag handling, reordering, imports from sidebar), renders the timeline,
 *       sidebar, and block edit dialog, and wires useWorkshop + usePlayMode
 *       together. Accepts optional prefillData to bootstrap from a landing page.
 * Used by: Index, LandingPage
 */
import { useState, useCallback, useEffect, useMemo, useRef, useContext, useLayoutEffect } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import { useLocale } from '@/contexts/LocaleContext';
import { Helmet } from 'react-helmet-async';
import { LOCALE_PREFIX, formatTitle } from '@/lib/metaConfig';
import { useIsLg } from '@/hooks/use-lg';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useWorkshop } from '@/hooks/useWorkshop';
import { useLibrary } from '@/contexts/LibraryContext';
import { DragDropProvider } from '@/hooks/useDragDropContext';
import { useDragHandlers } from '@/hooks/useDragHandlers';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import {
  calculateEffectiveDuration,
  exportWorkshopAsJson,
  importWorkshopFromJson,
  saveBlockToLibrary,
  saveTemplate,
  clearAllData,
  saveTempWorkshop,
  markTempWorkshopForRouteRestore,
  WorkshopTemplate,
  encodeWorkshopToUrl,
} from '@/lib/workshopStorage';
import { getSidebarCollapsed, setSidebarCollapsed as persistSidebarCollapsed, hasSidebarPreference, getShowFullPreviewText, setShowFullPreviewText as persistShowFullPreviewText, getPlayModeSounds, setPlayModeSounds as persistPlayModeSounds, getDefaultPrefs, upsertSessionToHistory, getTempWorkshopStore, getSessionHistory } from '@/lib/workshopLocalStorage';
import { WorkshopPageContext } from '@/contexts/WorkshopPageContext';
import { WorkshopItem, WorkshopPrefillData, generateId } from '@/types/workshop';
import {
  DEFAULT_BLOCK_DURATION,
  DEFAULT_BREAKOUT_DURATION,
  DEFAULT_LANES,
} from '@/lib/workshopDefaults';
import { WorkshopHeader } from '@/modules/planner/WorkshopHeader';
import { Timeline } from '@/modules/timeline/Timeline';
import { Sidebar } from '@/modules/sidebar/Sidebar';
import { DragOverlayContent } from '@/modules/timeline/DragOverlayContent';
import { PlayModeBar } from '@/modules/planner/PlayModeBar';
import { PageFooter } from '../layout/PageFooter';
import { usePlayMode } from '@/hooks/usePlayMode';
import { focusSessionInput, focusSessionElement, focusLastBlockTitleInput, scrollToLastBlock } from '@/lib/domUtils';
import { getWorkshopTitle } from '@/lib/workshopUtils';
import { HeaderActionButtons } from '@/modules/planner/HeaderActionButtons';
import { IncomingUpdateBanner } from '@/modules/planner/IncomingUpdateBanner';
import { Button } from '@/components/primitives/button';
import { toast } from 'sonner';
import { PlannerDialogs } from '@/modules/planner/PlannerDialogs';

interface WorkshopPlannerProps {
  prefillData?: WorkshopPrefillData;
  renderEmptyState?: (props: EmptyStateRenderProps) => ReactNode;
  onReset?: () => void;
}

export interface EmptyStateRenderProps {
  onAddBlock: () => void;
  onReopenSession: ReturnType<typeof useWorkshop>['loadSessionFromHistory'];
}

export const WorkshopPlanner = ({ prefillData, renderEmptyState, onReset }: WorkshopPlannerProps = {}) => {
  const { t } = useTranslation('common');
  const { setTheme } = useTheme();
  const { locale } = useLocale();
  const localePrefix = LOCALE_PREFIX[locale];
  const {
    workshop,
    updateMetadata,
    addItem,
    insertItemAfter,
    updateItem,
    deleteItem,
    reorderItems,
    moveItem,
    addBlockType,
    updateBlockType,
    deleteBlockType,
    addPerson,
    updatePerson,
    deletePerson,
    loadWorkshop,
    resetWorkshop,
    clearWorkshopCompletely,
    loadSessionFromHistory,
    sessionNotFound,
    clearSessionNotFound,
    serverKey,
    isLoadingFromServer,
    isEnablingServerMode,
    enableServerMode,
    disableServerMode,
    pollNow,
    incomingUpdate,
    acceptIncomingUpdate,
    forkSession,
    undo,
    redo,
    canUndo,
  } = useWorkshop(prefillData);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [emptyStateRevision, setEmptyStateRevision] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getSidebarCollapsed);
  const [showFullPreviewText, setShowFullPreviewTextState] = useState(getShowFullPreviewText);
  const [playModeSounds, setPlayModeSoundsState] = useState(getPlayModeSounds);
  const [startTimePopoverOpen, setStartTimePopoverOpen] = useState(false);
  const [saveTemplateDialog, setSaveTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showDisableServerDialog, setShowDisableServerDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkshopItem | null>(null);
  const dateLocale = locale === 'en' ? 'en-GB' : 'de-DE';

  const handleSetPlayModeSounds = useCallback((value: boolean) => {
    setPlayModeSoundsState(value);
    persistPlayModeSounds(value);
  }, []);

  const workshopPageRef = useContext(WorkshopPageContext);
  useLayoutEffect(() => {
    if (workshopPageRef) workshopPageRef.current = true;
  }, [workshopPageRef]);

  // Use Library Context for refreshing library and templates
  const { refreshBlocks, refreshTemplates, refreshAll } = useLibrary();
  const isLg = useIsLg();

  const totalDuration = calculateEffectiveDuration(workshop.items, workshop.workshop.startTime);

  const snapshotUrl = useMemo(() => {
    const encoded = encodeWorkshopToUrl(workshop);
    return encoded ? `${window.location.origin}${window.location.pathname}#data=${encoded}` : window.location.href;
  }, [workshop]);

  const playMode = usePlayMode(workshop, totalDuration, playModeSounds);

  const prevItemCountRef = useRef(workshop.items.length);

  // Auto-expand sidebar when first block is added, but only if the user hasn't
  // explicitly set a sidebar preference yet (don't persist this expansion).
  useEffect(() => {
    const prev = prevItemCountRef.current;
    prevItemCountRef.current = workshop.items.length;
    if (prev === 0 && workshop.items.length === 1 && !hasSidebarPreference()) {
      setSidebarCollapsed(false);
    }
  }, [workshop.items.length]);

  // Show toast when a dynamic link points to a non-existent session
  useEffect(() => {
    if (sessionNotFound) {
      toast.error(t('planner.sessionNotFound'));
      clearSessionNotFound();
    }
  }, [sessionNotFound, clearSessionNotFound, t]);

  // Update page title when session title changes (only when workshop has content)
  useEffect(() => {
    if (workshop.items.length > 0) {
      document.title = formatTitle(workshop.workshop.title);
    }
  }, [workshop.workshop.title, workshop.items.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const {
    activeId,
    activeData,
    activeParentId,
    dropIndicator,
    customCollisionDetection,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  } = useDragHandlers({
    workshopItems: workshop.items,
    addItem,
    insertItemAfter,
    updateItem,
    moveItem,
    reorderItems,
    t,
  });

  const handleEnableServerMode = useCallback(async () => {
    await enableServerMode();
  }, [enableServerMode]);

  const getShareUrl = useCallback(() => {
    if (serverKey) {
      const url = new URL(window.location.href);
      url.hash = '';
      url.searchParams.set('id', serverKey);
      return url.toString();
    }
    return window.location.href;
  }, [serverKey]);

  const handleToggleServerMode = useCallback(async (checked: boolean) => {
    if (checked) {
      try {
        await handleEnableServerMode();
      } catch {
        toast.error(t('planner.permanentLinkError'));
      }
    } else {
      setShowDisableServerDialog(true);
    }
  }, [handleEnableServerMode, t]);

  const handleExport = useCallback(() => {
    exportWorkshopAsJson(workshop);
    toast.success(t('planner.exportSuccess'));
  }, [workshop]);

  const handleImport = useCallback(async (file: File) => {
    try {
      const data = await importWorkshopFromJson(file);
      loadWorkshop(data);
      toast.success(t('planner.importSuccess'));
    } catch (error) {
      toast.error(t('planner.importFailed'));
    }
  }, [loadWorkshop]);

  const handleAddBlock = useCallback((blockTypeId: string) => {
    addItem({
      type: 'block',
      blockTypeId,
      title: t('block.newBlock'),
      duration: DEFAULT_BLOCK_DURATION,
      notes: '',
      material: '',
    });
    const blockType = workshop.blockTypes.find(bt => bt.id === blockTypeId);
    setSidebarOpen(false);
  }, [addItem, workshop.blockTypes, t]);

  const handleAddGroup = useCallback(() => {
    addItem({
      type: 'group',
      blockTypeId: null,
      title: t('block.newGroup'),
      duration: 0,
      notes: '',
      material: '',
      children: [],
      durationLocked: false,
    });
    setSidebarOpen(false);
  }, [addItem]);

  const handleAddBreakout = useCallback(() => {
    addItem({
      type: 'breakout',
      blockTypeId: null,
      title: t('block.newBreakout'),
      duration: DEFAULT_BREAKOUT_DURATION,
      notes: '',
      material: '',
      children: [],
      parallel: true,
      lanes: DEFAULT_LANES,
      sameInAllBreakouts: false,
    });
    setSidebarOpen(false);
  }, [addItem]);

  const handleAddFromLibrary = useCallback((item: WorkshopItem) => {
    addItem({
      type: item.type,
      blockTypeId: item.blockTypeId,
      title: item.title,
      duration: item.duration,
      notes: item.notes,
      material: item.material,
      children: item.children?.map(child => ({ ...child, id: generateId() })),
    });
    setSidebarOpen(false);
    toast.success(t('dialog.addedFromLibrary'));
  }, [addItem]);

  const handleSaveToLibrary = useCallback(async (item: WorkshopItem) => {
    await saveBlockToLibrary(item.title, item);
    refreshBlocks();
    toast.success(t('dialog.savedToLibrary'));
  }, [refreshBlocks]);

  const handleLoadTemplate = useCallback((template: WorkshopTemplate) => {
    loadWorkshop(template.data);
    toast.success(t('dialog.templateLoaded'));
  }, [loadWorkshop]);

  const handleSaveAsTemplate = useCallback(async () => {
    if (templateName.trim()) {
      await saveTemplate(templateName.trim(), workshop);
      refreshTemplates();
      toast.success(t('dialog.templateSaved'));
      setTemplateName('');
      setSaveTemplateDialog(false);
    }
  }, [templateName, workshop, refreshTemplates]);

  const handleReset = useCallback(() => {
    resetWorkshop();
    onReset?.();
  }, [resetWorkshop, onReset]);

  const handleClearAll = useCallback(async () => {
    await clearAllData();
    clearWorkshopCompletely();
    refreshAll();
    setSidebarCollapsed(getDefaultPrefs().sidebarCollapsed);
    setShowFullPreviewTextState(getDefaultPrefs().showFullPreviewText);
    setPlayModeSoundsState(getDefaultPrefs().playModeSounds);
    setTheme('system');
    setEmptyStateRevision((revision) => revision + 1);
    toast.success(t('settings.clearAllSuccess'));
    onReset?.();
  }, [clearWorkshopCompletely, refreshAll, onReset, setTheme, t]);

  // Shortcut-only handlers: add a generic (untyped) block / group / breakout
  // to the end of the root timeline. Mirror the sticky add buttons in Timeline.
  const handleAddBlockShortcut = useCallback(() => {
    addItem({
      type: 'block',
      blockTypeId: null,
      title: t('block.newBlock'),
      duration: DEFAULT_BLOCK_DURATION,
      notes: '',
      material: '',
    });
  }, [addItem, t]);

  const handleAddEmptyStateBlock = useCallback(() => {
    handleAddBlockShortcut();
    focusLastBlockTitleInput();
    scrollToLastBlock();
  }, [handleAddBlockShortcut]);

  const handleAddGroupShortcut = useCallback(() => {
    addItem({
      type: 'group',
      blockTypeId: null,
      title: t('block.newGroup'),
      duration: 0,
      notes: '',
      material: '',
      children: [],
      durationLocked: false,
    });
  }, [addItem, t]);

  const handleAddBreakoutShortcut = useCallback(() => {
    addItem({
      type: 'breakout',
      blockTypeId: null,
      title: t('block.newBreakout'),
      duration: DEFAULT_BREAKOUT_DURATION,
      notes: '',
      material: '',
      children: [],
      parallel: true,
      lanes: DEFAULT_LANES,
      sameInAllBreakouts: false,
    });
  }, [addItem, t]);

  // N-th block type: 1-9 → add a block of that type (sidebar display order)
  const handleAddBlockOfType = useCallback((blockTypeId: string) => {
    handleAddBlock(blockTypeId);
  }, [handleAddBlock]);

  const handleTogglePlayModeShortcut = useCallback(() => {
    if (playMode.isActive) {
      playMode.deactivate();
    } else {
      playMode.activate();
    }
  }, [playMode]);

  const handleCloseSessionShortcut = useCallback(() => {
    resetWorkshop();
    onReset?.();
  }, [resetWorkshop, onReset]);

  const handleFocusSessionTitleShortcut = useCallback(() => {
    focusSessionInput('data-session-title-input');
  }, []);

  const handleFocusSessionDescriptionShortcut = useCallback(() => {
    focusSessionElement('data-session-description');
  }, []);

  const handleOpenStartTimeShortcut = useCallback(() => {
    setStartTimePopoverOpen(true);
  }, []);

  const handleOpenDateShortcut = useCallback(() => {
    document.querySelector<HTMLElement>('[data-date-trigger]')?.click();
  }, []);

  const handleOpenShareShortcut = useCallback(() => {
    document.querySelector<HTMLElement>('[data-share-trigger]')?.click();
  }, []);

  useKeyboardShortcuts({
    blockTypes: workshop.blockTypes,
    onAddBlock: handleAddBlockShortcut,
    onAddGroup: handleAddGroupShortcut,
    onAddBreakout: handleAddBreakoutShortcut,
    onAddBlockOfType: handleAddBlockOfType,
    onTogglePlayMode: handleTogglePlayModeShortcut,
    onCloseSession: handleCloseSessionShortcut,
    onFocusSessionTitle: handleFocusSessionTitleShortcut,
    onFocusSessionDescription: handleFocusSessionDescriptionShortcut,
    onOpenStartTime: handleOpenStartTimeShortcut,
    onOpenDate: handleOpenDateShortcut,
    onOpenShare: handleOpenShareShortcut,
    onUndo: undo,
    onRedo: redo,
    enabled: !editingItem && !isLoadingFromServer,
  });

  return (
    <>
      {isLoadingFromServer ? (
        <div className="flex min-h-screen w-full items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <svg className="h-6 w-6 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm">{t('planner.permanentLinkCreating')}</span>
          </div>
        </div>
      ) : (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {workshop.items.length > 0 && (
        <Helmet><title>{formatTitle(getWorkshopTitle(workshop.workshop.title, t))}</title></Helmet>
      )}
      <DragDropProvider value={{ activeId, activeData, activeParentId, dropIndicator }}>
        {/* Planner chrome stays at the top; page-provided empty content follows it. */}
        <div className={`sticky top-0 z-30 print:static print:px-0 print:pt-0 transition-[padding-left] duration-200 ease-out ${sidebarCollapsed ? '' : 'lg:pl-72'}`}>
          <div className="flex flex-col items-stretch gap-0 sm:flex-row sm:items-start sm:gap-3 sm:px-4 sm:pt-3 bg-card/95 backdrop-blur-sm supports-[backdrop-filter]:bg-card/80 sm:bg-transparent sm:backdrop-blur-none sm:border-0">
            <WorkshopHeader
              metadata={workshop.workshop}
              totalDuration={totalDuration}
              onUpdate={updateMetadata}
              isSidebarCollapsed={sidebarCollapsed}
              startTimePopoverOpen={startTimePopoverOpen}
              onStartTimePopoverOpenChange={setStartTimePopoverOpen}
              asHeading={workshop.items.length > 0}
              onMenuClick={() => {
                if (sidebarCollapsed && isLg) {
                  setSidebarCollapsed(false);
                  persistSidebarCollapsed(false);
                } else {
                  setSidebarOpen(true);
                }
              }}
            />
            <HeaderActionButtons
              playMode={playMode}
              onReset={handleReset}
              serverKey={serverKey}
              isEnablingServerMode={isEnablingServerMode}
              onToggleServerMode={handleToggleServerMode}
              getShareUrl={getShareUrl}
              snapshotUrl={snapshotUrl}
              lastModified={workshop.workshop.lastModified}
              dateLocale={dateLocale}
              canUndo={canUndo}
              onUndo={undo}
              onMenuClick={() => {
                if (sidebarCollapsed && isLg) {
                  setSidebarCollapsed(false);
                  persistSidebarCollapsed(false);
                } else {
                  setSidebarOpen(true);
                }
              }}
              isSidebarCollapsed={sidebarCollapsed}
              hasActions={workshop.items.length >= 1}
            />
          </div>
          {playMode.isActive && (
            <PlayModeBar
              label={playMode.currentDisplay?.label ?? null}
              prevLabel={playMode.currentDisplay?.prevLabel ?? null}
              nextLabel={playMode.currentDisplay?.nextLabel ?? null}
              elapsedInCurrentBlock={playMode.elapsedInCurrentBlock}
              currentBlockDuration={playMode.currentBlockEffectiveDuration}
              soundPulse={playMode.soundPulse}
              onExtendBlock={() => {
                const currentBlock = playMode.currentDisplay?.current;
                if (currentBlock) {
                  updateItem(currentBlock.id, { duration: currentBlock.endMin - currentBlock.startMin + 5 });
                }
              }}
              soundsEnabled={playModeSounds}
              onToggleSounds={() => handleSetPlayModeSounds(!playModeSounds)}
              onDeactivate={playMode.deactivate}
            />
          )}
          {incomingUpdate && (
            <IncomingUpdateBanner
              onAccept={acceptIncomingUpdate}
              onFork={forkSession}
              isForking={isEnablingServerMode}
              serverKey={serverKey}
            />
          )}
        </div>
        {workshop.items.length === 0 && renderEmptyState && (
          <main className={`w-full ${sidebarCollapsed ? '' : 'lg:pl-72'}`}>
            <div key={emptyStateRevision} className="contents">
              {renderEmptyState({
                onAddBlock: handleAddEmptyStateBlock,
                onReopenSession: loadSessionFromHistory,
              })}
            </div>
          </main>
        )}
        <div className={`flex w-full bg-background ${workshop.items.length > 0 ? 'min-h-screen' : ''}`}>
      {/* Spacer: reserves horizontal space for the fixed sidebar on desktop */}
      <div className={`hidden lg:block flex-shrink-0 transition-all duration-200 ease-out ${sidebarCollapsed ? 'w-0' : 'w-72'}`} />
      {/* Sidebar */}
      <Sidebar
        blockTypes={workshop.blockTypes}
        persons={workshop.persons || []}
        onAddBlock={handleAddBlock}
        onAddGroup={handleAddGroup}
        onAddBreakout={handleAddBreakout}
        onAddFromLibrary={handleAddFromLibrary}
        onLoadTemplate={handleLoadTemplate}
        onAddBlockType={addBlockType}
        onUpdateBlockType={updateBlockType}
        onDeleteBlockType={deleteBlockType}
        onAddPerson={addPerson}
        onUpdatePerson={updatePerson}
        onDeletePerson={deletePerson}
        showFullPreviewText={showFullPreviewText}
        onSetShowFullPreviewText={(value) => {
          setShowFullPreviewTextState(value);
          persistShowFullPreviewText(value);
        }}
        playModeSounds={playModeSounds}
        onSetPlayModeSounds={handleSetPlayModeSounds}
        onExport={handleExport}
        onImport={handleImport}
        onReset={handleReset}
        onClearAll={handleClearAll}
        onSaveAsTemplate={workshop.items.length > 0 ? () => setSaveTemplateDialog(true) : undefined}
        itemsCount={workshop.items.length}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => {
            const next = !sidebarCollapsed;
            setSidebarCollapsed(next);
            persistSidebarCollapsed(next);
          }}
      />
          {/* Main content */}
          <div className="flex-1 min-w-0">
        {/* Timeline */}
        <div className="mx-auto px-6 md:px-0 overflow-x-clip lg:overflow-x-visible">
          <Timeline
            items={workshop.items}
            blockTypes={workshop.blockTypes}
            persons={workshop.persons || []}
            showFullPreviewText={showFullPreviewText}
            startTime={workshop.workshop.startTime}
            targetDuration={workshop.workshop.targetDuration}
            durationLocked={workshop.workshop.durationLocked}
            onReorder={reorderItems}
            onUpdateItem={updateItem}
            onDeleteItem={deleteItem}
            onAddItem={addItem}
            onInsertItemAfter={insertItemAfter}
            onSaveToLibrary={handleSaveToLibrary}
            onMoveItem={moveItem}
            activeId={activeId}
            activeData={activeData}
            dropIndicator={dropIndicator}
            onTimelineDragEnd={handleDragEnd}
            blockPlayStates={playMode.blockPlayStates}
            onOpenDialog={serverKey ? pollNow : undefined}
            date={workshop.workshop.date}
            description={workshop.workshop.description}
            onUpdateDescription={(desc) => updateMetadata({ description: desc })}
            onUpdateStartTime={(time) => updateMetadata({ startTime: time })}
            onAddStartTimeClick={() => setStartTimePopoverOpen(true)}
            editingItem={editingItem}
            onEditingItemChange={setEditingItem}
          />

          {/* Footer */}
          <PageFooter
            className="mt-12"
            showLanguageSwitcher={false}
            leadingContent={serverKey ? undefined : t('planner.savedToBrowser')}
            onBeforeNavigate={(path) => {
              saveTempWorkshop(workshop);
              if (path !== `${localePrefix}/landing-pages`) {
                markTempWorkshopForRouteRestore();
              }
            }}
          />
        </div>
      </div>

      </div>
      </DragDropProvider>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeId && (
          <DragOverlayContent
            activeId={activeId}
            activeData={activeData}
            items={workshop.items}
            blockTypes={workshop.blockTypes}
          />
        )}
      </DragOverlay>

      <PlannerDialogs
        saveTemplateDialog={saveTemplateDialog}
        onSaveTemplateDialogChange={setSaveTemplateDialog}
        templateName={templateName}
        onTemplateNameChange={setTemplateName}
        onSaveTemplate={handleSaveAsTemplate}
        showDisableServerDialog={showDisableServerDialog}
        onShowDisableServerDialogChange={setShowDisableServerDialog}
        onConfirmDisableServer={() => { disableServerMode(); setShowDisableServerDialog(false); clearSessionNotFound(); }}
      />
      </DndContext>
      )}
    </>
  );
};
