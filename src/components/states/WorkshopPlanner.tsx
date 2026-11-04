/**
 * WorkshopPlanner — Top-level planner container component.
 *
 * Role: Orchestrates the entire workshop planning UI. Owns the DndContext
 *       (drag handling, reordering, imports from sidebar), renders the timeline,
 *       sidebar, and block edit dialog, and wires useWorkshop + usePlayMode
 *       together. Accepts optional prefillData to bootstrap from a landing page.
 * Used by: Index, LandingPage
 */
import { useState, useCallback, useEffect, useMemo, useRef, useContext, useLayoutEffect, lazy, Suspense } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useFirstBlockAdded } from '@/hooks/useFirstBlockAdded';
import { useMobileHeaderHidden } from '@/hooks/useMobileHeaderHidden';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import { useLocale } from '@/contexts/LocaleContext';
import { Helmet } from 'react-helmet-async';
import { formatTitle } from '@/lib/metaConfig';
import { useIsLg } from '@/hooks/use-lg';
import { useIsMobile } from '@/hooks/use-mobile';
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
import { usePlannerDataActions } from '@/hooks/usePlannerDataActions';
import { usePlannerPreferences } from '@/hooks/usePlannerPreferences';
import { usePlannerShortcuts } from '@/hooks/usePlannerShortcuts';
import { useServerLinkActions } from '@/hooks/useServerLinkActions';
import { useSessionCloseFlow } from '@/hooks/useSessionCloseFlow';
import { refreshKeyboardShortcutsEnabled } from '@/hooks/useKeyboardShortcutsEnabled';
import { KeyboardShortcutHints } from '@/components/sections/KeyboardShortcutHints';
import { KeyboardShortcutsDialog } from '@/components/sections/KeyboardShortcutsDialog';
import { useFeedbackPrompt } from '@/hooks/useFeedbackPrompt';
import { FEEDBACK_API_URL } from '@/lib/feedback-api';
import { FeedbackPromptLayer } from '@/modules/planner/FeedbackPromptLayer';
import { calculateEffectiveDuration, clearAllData } from '@/lib/workshopStorage';
import { WorkshopPageContext } from '@/contexts/WorkshopPageContext';
import type { WorkshopItem, WorkshopPrefillData } from '@/types/workshop';
import { WorkshopHeader } from '@/modules/planner/WorkshopHeader';
import { Timeline } from '@/modules/timeline/Timeline';
import { Sidebar } from '@/modules/sidebar/Sidebar';
import { DragOverlayContent } from '@/modules/timeline/DragOverlayContent';
import { PlayModeBar } from '@/modules/planner/PlayModeBar';
import { PageFooter } from '../layout/PageFooter';
import { useLiveDay } from '@/hooks/useLiveDay';
import { getAllItems, getDayLabel, hasAnyItems } from '@/lib/workshop-days';
import { DayBoxes } from '@/modules/planner/DayBoxes';
import { DayStrip } from '@/modules/planner/DayStrip';
import { DayControls } from '@/modules/planner/DayControls';
import { focusLastBlockTitleInput, scrollToLastBlock } from '@/lib/domUtils';
import { createBlockOfType, createItemFromLibrary, createNewBreakout, createNewGroup, getWorkshopTitle } from '@/lib/workshopUtils';
import { HeaderActionButtons } from '@/modules/planner/HeaderActionButtons';
import { PlannerLoadingScreen } from '@/modules/planner/PlannerLoadingScreen';
import { SyncStatusBanners } from '@/modules/planner/SyncStatusBanners';
import { toast } from 'sonner';
import { PlannerDialogs } from '@/modules/planner/PlannerDialogs';
import { useElementHeight } from '@/hooks/useElementHeight';
import { computeLiveCurrentMinute } from '@/lib/timeVisualization';
import { handleChunkLoadError } from '@/lib/lazyRoute';

// Lazy-loaded so the strip's chunk only ships to desktop users with the
// setting enabled. Combined with the `isLg && timeVisualizationStrip` gate
// below, mobile / opted-out users pay zero cost for the feature.
const TimeVisualizationStrip = lazy(() =>
  import('@/modules/planner/TimeVisualizationStrip')
    .then((m) => ({
      default: m.TimeVisualizationStrip,
    }))
    .catch((error): Promise<never> => {
      // Deploy deletes old hashed chunks — recover with a single guarded reload.
      if (handleChunkLoadError(error)) {
        return new Promise(() => {});
      }
      throw error;
    }),
);

const POINTER_DRAG_ACTIVATION_DISTANCE_PX = 8;
const TOUCH_DRAG_ACTIVATION_DELAY_MS = 250;
const TOUCH_DRAG_ACTIVATION_TOLERANCE_PX = 5;
const LIVE_MODE_EXTENSION_MINUTES = 5;

interface WorkshopPlannerProps {
  prefillData?: WorkshopPrefillData;
  renderEmptyState?: (props: EmptyStateRenderProps) => ReactNode;
  onReset?: () => void;
}

interface EmptyStateRenderProps {
  onAddBlock: () => void;
  onReopenSession: ReturnType<typeof useWorkshop>['loadSessionFromHistory'];
}

export const WorkshopPlanner = ({ prefillData, renderEmptyState, onReset }: WorkshopPlannerProps = {}) => {
  const { t } = useTranslation('common');
  const { setTheme } = useTheme();
  const { locale } = useLocale();
  const {
    // `plan` is the full document; `activeDay` is the shown day as a regular
    // single-day plan, so day-agnostic components keep working unchanged.
    workshop: plan,
    dayWorkshop: activeDay,
    days,
    activeDayId,
    setActiveDay,
    addDay,
    duplicateDay,
    removeDay,
    moveDay,
    updateDay,
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
    sessionUnavailable,
    clearSessionUnavailable,
    serverKey,
    canEditServerSession,
    isLegacyServerSession,
    isLoadingFromServer,
    isServerSessionLoaded,
    isEnablingServerMode,
    enableServerMode,
    disableServerMode,
    pollNow,
    incomingUpdate,
    hasUnsyncedChanges,
    syncFailureReason,
    acceptIncomingUpdate,
    setHasPendingFormEdits,
    migrateLegacySession,
    legacyMigrationStatus,
    createLocalCopy,
    resetSyncState,
    getHasUnsavedCloseRisk,
    undo,
    redo,
    canUndo,
  } = useWorkshop(prefillData);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [emptyStateRevision, setEmptyStateRevision] = useState(0);
  const [startTimePopoverOpen, setStartTimePopoverOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WorkshopItem | null>(null);
  // Mirrors HeaderActionButtons' share popover open state so the feedback
  // prompt can suppress itself while the user is interacting with it.
  const [sharePopoverOpen, setSharePopoverOpen] = useState(false);
  const dateLocale = locale === 'en' ? 'en-GB' : 'de-DE';

  const preferences = usePlannerPreferences();
  const {
    sidebarCollapsed,
    showFullPreviewText,
    playModeSounds,
    timeVisualizationStrip,
  } = preferences;

  const closeFlow = useSessionCloseFlow({
    getHasUnsavedCloseRisk,
    resetSyncState,
    resetWorkshop,
    onReset,
    legacyMigrationStatus,
    migrateLegacySession,
  });

  const workshopPageRef = useContext(WorkshopPageContext);
  useLayoutEffect(() => {
    if (workshopPageRef) workshopPageRef.current = true;
  }, [workshopPageRef]);

  const { refreshAll } = useLibrary();
  const isLg = useIsLg();
  const isMobile = useIsMobile();

  const totalDuration = calculateEffectiveDuration(activeDay.items, activeDay.workshop.startTime);
  const planHasItems = hasAnyItems(plan);
  const multiDay = days.length > 1;

  // Ref + observed height of the sticky planner chrome. The TimeVisualizationStrip
  // positions itself just below this element so it never collides with the
  // header, PlayModeBar, or incoming-update banners.
  const plannerHeaderRef = useRef<HTMLDivElement | null>(null);
  const plannerHeaderHeight = useElementHeight(plannerHeaderRef);
  const plannerControlsRef = useRef<HTMLDivElement | null>(null);
  const actionBarRef = useRef<HTMLDivElement | null>(null);
  const actionBarHeight = useElementHeight(actionBarRef);
  // On mobile the day tabs sit at the top, a day switch starts reading there too.
  const mobileHeaderHidden = useMobileHeaderHidden(plannerControlsRef, actionBarHeight, activeDayId);

  // Ref to the timeline content root (the wrapper around <Timeline />). The
  // TimeVisualizationStrip reads block card positions inside this container
  // to compute the viewport indicator.
  const timelineContentRef = useRef<HTMLDivElement | null>(null);

  const serverLink = useServerLinkActions({
    plan,
    activeDayId,
    serverKey,
    enableServerMode,
    disableServerMode,
    clearSessionNotFound,
  });

  const { playMode, liveDayId } = useLiveDay(plan, activeDayId, playModeSounds);
  const liveDayLabel = multiDay && playMode.isActive
    ? getDayLabel(days, liveDayId, t)
    : null;
  const dayTabsProps = {
    days,
    activeDayId,
    liveDayId: playMode.isActive ? liveDayId : null,
    dateLocale,
    onSelect: setActiveDay,
    onAdd: addDay,
    onDuplicate: duplicateDay,
    onRemove: removeDay,
    onMove: moveDay,
    onUpdate: updateDay,
  };

  // Live Mode's current minute, fed into the strip's "now" marker. null when
  // Live Mode is off or the elapsed value isn't determinable.
  const liveCurrentMinute = computeLiveCurrentMinute({
    isActive: playMode.isActive && liveDayId === activeDayId,
    elapsedMinutes: playMode.elapsedMinutes,
  });

  // Auto-expand sidebar when first block is added, but only if the user hasn't
  // explicitly set a sidebar preference yet (don't persist this expansion).
  useFirstBlockAdded(activeDay.items.length, activeDayId, preferences.expandSidebarByDefault);

  // Show toast when a dynamic link points to a non-existent session
  useEffect(() => {
    if (sessionNotFound) {
      toast.error(t('planner.sessionNotFound'));
      clearSessionNotFound();
    }
  }, [sessionNotFound, clearSessionNotFound, t]);

  // Show toast when the shared session can't be reached (offline / network /
  // server / timeout). The key is kept in the URL so the user can retry.
  useEffect(() => {
    if (sessionUnavailable) {
      toast.error(t(`planner.sessionUnavailable.${sessionUnavailable}`));
      clearSessionUnavailable();
    }
  }, [sessionUnavailable, clearSessionUnavailable, t]);

  // Update page title when session title changes (only when workshop has content)
  useEffect(() => {
    if (planHasItems) {
      document.title = formatTitle(activeDay.workshop.title);
    }
  }, [activeDay.workshop.title, planHasItems]);

  const hasTrackedRef = useRef(false);
  useEffect(() => {
    if (isLoadingFromServer) return;
    if (hasTrackedRef.current) return;
    hasTrackedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingFromServer]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: POINTER_DRAG_ACTIVATION_DISTANCE_PX,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: TOUCH_DRAG_ACTIVATION_DELAY_MS,
        tolerance: TOUCH_DRAG_ACTIVATION_TOLERANCE_PX,
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
    workshopItems: activeDay.items,
    addItem,
    updateItem,
    moveItem,
    reorderItems,
    t,
  });

  // Optional in-app feedback prompt. We always call the hook — when
  // FEEDBACK_API_URL is not configured the hook returns the inert `hidden`
  // variant and zero-cost controls, so self-hosted deployments without the
  // ingest endpoint pay nothing.
  const feedbackPrompt = useFeedbackPrompt({
    workshop: plan,
    playModeActive: playMode.isActive,
    // No separate "share dialog" exists; the share popover is the only share
    // UI, so leave the dialog flag false and forward the popover state below.
    shareDialogOpen: false,
    sharePopoverOpen,
  });

  const dataActions = usePlannerDataActions({ plan, loadWorkshop });

  const handleAddBlock = useCallback((blockTypeId: string) => {
    const blockType = activeDay.blockTypes.find(bt => bt.id === blockTypeId);
    if (!blockType) return;
    addItem(createBlockOfType(blockType, t));
    setSidebarOpen(false);
  }, [addItem, activeDay.blockTypes, t]);

  const handleAddGroup = () => {
    addItem(createNewGroup(t));
    setSidebarOpen(false);
  };

  const handleAddBreakout = () => {
    addItem(createNewBreakout(t));
    setSidebarOpen(false);
  };

  const handleAddFromLibrary = (item: WorkshopItem) => {
    addItem(createItemFromLibrary(item));
    setSidebarOpen(false);
    toast.success(t('dialog.addedFromLibrary'));
  };

  const handleClearAll = async () => {
    await clearAllData();
    resetSyncState();
    clearWorkshopCompletely();
    refreshAll();
    preferences.resetToDefaults();
    refreshKeyboardShortcutsEnabled();
    setTheme('system');
    setEmptyStateRevision((revision) => revision + 1);
    toast.success(t('settings.clearAllSuccess'));
    onReset?.();
  };

  const handleMenuClick = () => {
    if (sidebarCollapsed && isLg) {
      preferences.setSidebarCollapsed(false);
    } else {
      setSidebarOpen(true);
    }
  };

  const handleOpenStartTime = useCallback(() => setStartTimePopoverOpen(true), []);
  const dayIds = useMemo(() => days.map((day) => day.id), [days]);

  const shortcuts = usePlannerShortcuts({
    blockTypes: activeDay.blockTypes,
    dayIds,
    planHasItems,
    isAvailable: !editingItem && !isLoadingFromServer,
    isPlayModeActive: playMode.isActive,
    activatePlayMode: playMode.activate,
    deactivatePlayMode: playMode.deactivate,
    addItem,
    addBlockOfType: handleAddBlock,
    addDay,
    selectDay: setActiveDay,
    closeSession: closeFlow.handleCloseSessionShortcut,
    openStartTime: handleOpenStartTime,
    undo,
    redo,
  });

  const handleAddEmptyStateBlock = () => {
    shortcuts.addBlock();
    focusLastBlockTitleInput();
    scrollToLastBlock();
  };

  return (
    <>
      {isLoadingFromServer ? (
        <PlannerLoadingScreen />
      ) : (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {planHasItems && (
        <Helmet><title>{formatTitle(getWorkshopTitle(activeDay.workshop.title, t))}</title></Helmet>
      )}
      <DragDropProvider value={{ activeId, activeData, activeParentId, dropIndicator }}>
        {/* Planner chrome stays at the top; page-provided empty content follows it. */}
        <div
          ref={plannerHeaderRef}
          style={{ '--planner-header-top': mobileHeaderHidden ? `-${actionBarHeight}px` : '0px' } as CSSProperties}
          className={`sticky top-[var(--planner-header-top)] md:top-0 z-30 print:static print:px-0 print:pt-0 transition-[top,padding-left] duration-200 ease-out motion-reduce:transition-none ${sidebarCollapsed ? '' : 'lg:pl-72'}`}
        >
          <div ref={plannerControlsRef} className="planner-chrome-row flex flex-col items-stretch gap-0 md:flex-row md:items-start md:gap-3 md:px-4 bg-card/95 backdrop-blur-sm supports-[backdrop-filter]:bg-card/80 md:bg-transparent md:backdrop-blur-none md:border-0">
            <WorkshopHeader
              metadata={activeDay.workshop}
              totalDuration={totalDuration}
              onUpdate={updateMetadata}
              isSidebarCollapsed={sidebarCollapsed}
              startTimePopoverOpen={startTimePopoverOpen}
              onStartTimePopoverOpenChange={setStartTimePopoverOpen}
              asHeading={planHasItems}
              titleOnly={multiDay && !isMobile}
              dayTabs={multiDay && isMobile ? <DayStrip {...dayTabsProps} /> : null}
              onAddDay={planHasItems && !multiDay ? addDay : undefined}
              printDayLabel={multiDay ? getDayLabel(days, activeDayId, t) : undefined}
              onMenuClick={handleMenuClick}
            />
            {multiDay && !isMobile && (
              <DayBoxes
                {...dayTabsProps}
                activeControls={
                  <DayControls
                    strongIcons
                    metadata={activeDay.workshop}
                    totalDuration={totalDuration}
                    onUpdate={updateMetadata}
                    startTimePopoverOpen={startTimePopoverOpen}
                    onStartTimePopoverOpenChange={setStartTimePopoverOpen}
                  />
                }
              />
            )}
            <HeaderActionButtons
              actionBarRef={actionBarRef}
              isReadOnly={!!serverKey && isServerSessionLoaded && !canEditServerSession}
              playMode={playMode}
              onReset={closeFlow.handleReset}
              serverKey={serverKey}
              isEnablingServerMode={isEnablingServerMode}
              onToggleServerMode={serverLink.handleToggleServerMode}
              getEditorShareUrl={serverLink.getEditorShareUrl}
              getReadOnlyShareUrl={serverLink.getReadOnlyShareUrl}
              canEditServerSession={canEditServerSession}
              isLegacyServerSession={isLegacyServerSession}
              onMigrateLegacyLink={closeFlow.handleMigrateLegacyLink}
              legacyMigrationStatus={legacyMigrationStatus}
              snapshotUrl={serverLink.snapshotUrl}
              lastModified={activeDay.workshop.lastModified}
              dateLocale={dateLocale}
              canUndo={canUndo}
              onUndo={undo}
              onMenuClick={handleMenuClick}
              isSidebarCollapsed={sidebarCollapsed}
              hasActions={planHasItems}
              onSharePopoverOpenChange={setSharePopoverOpen}
            />
          </div>
          {playMode.isActive && (
            <PlayModeBar
              dayLabel={liveDayLabel}
              label={playMode.currentDisplay?.label ?? null}
              prevLabel={playMode.currentDisplay?.prevLabel ?? null}
              nextLabel={playMode.currentDisplay?.nextLabel ?? null}
              elapsedInCurrentBlock={playMode.elapsedInCurrentBlock}
              currentBlockDuration={playMode.currentBlockEffectiveDuration}
              soundPulse={playMode.soundPulse}
              onExtendBlock={() => {
                const currentBlock = playMode.currentDisplay?.current;
                if (currentBlock) {
                  updateItem(currentBlock.id, { duration: currentBlock.endMin - currentBlock.startMin + LIVE_MODE_EXTENSION_MINUTES });
                }
              }}
              soundsEnabled={playModeSounds}
              onToggleSounds={() => preferences.setPlayModeSounds(!playModeSounds)}
              onDeactivate={playMode.deactivate}
            />
          )}
          <SyncStatusBanners
            serverKey={serverKey}
            incomingUpdate={!!incomingUpdate}
            canEditServerSession={canEditServerSession}
            hasUnsyncedChanges={hasUnsyncedChanges}
            syncFailureReason={syncFailureReason}
            onAcceptIncomingUpdate={acceptIncomingUpdate}
            onCreateLocalCopy={createLocalCopy}
            onDownload={dataActions.handleExport}
          />
        </div>
        {!planHasItems && renderEmptyState && (
          <main className={`w-full ${sidebarCollapsed ? '' : 'lg:pl-72'}`}>
            <div key={emptyStateRevision} className="contents">
              {renderEmptyState({
                onAddBlock: handleAddEmptyStateBlock,
                onReopenSession: loadSessionFromHistory,
              })}
            </div>
          </main>
        )}
        <div className={`flex w-full bg-background ${planHasItems ? 'min-h-screen' : ''}`}>
      {/* Spacer: reserves horizontal space for the fixed sidebar on desktop */}
      <div className={`hidden lg:block flex-shrink-0 transition-all duration-200 ease-out ${sidebarCollapsed ? 'w-0' : 'w-72'}`} />
      {/* Sidebar */}
      <Sidebar
        blockTypes={activeDay.blockTypes}
        persons={activeDay.persons || []}
        onAddBlock={handleAddBlock}
        onAddGroup={handleAddGroup}
        onAddBreakout={handleAddBreakout}
        onAddFromLibrary={handleAddFromLibrary}
        onLoadTemplate={dataActions.handleLoadTemplate}
        onAddBlockType={addBlockType}
        onUpdateBlockType={updateBlockType}
        onDeleteBlockType={deleteBlockType}
        onAddPerson={addPerson}
        onUpdatePerson={updatePerson}
        onDeletePerson={deletePerson}
        showFullPreviewText={showFullPreviewText}
        onSetShowFullPreviewText={preferences.setShowFullPreviewText}
        playModeSounds={playModeSounds}
        onSetPlayModeSounds={preferences.setPlayModeSounds}
        timeVisualizationStrip={timeVisualizationStrip}
        onSetTimeVisualizationStrip={preferences.setTimeVisualizationStrip}
        onExport={dataActions.handleExport}
        onExportCsv={dataActions.handleExportCsv}
        onImport={dataActions.handleImport}
        onImportText={dataActions.handleImportText}
        onReset={closeFlow.handleReset}
        onClearAll={handleClearAll}
        onSaveAsTemplate={planHasItems ? () => dataActions.setSaveTemplateDialogOpen(true) : undefined}
        itemsCount={getAllItems(plan).length}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => preferences.setSidebarCollapsed(!sidebarCollapsed)}
        onOpenFeedback={FEEDBACK_API_URL ? () => feedbackPrompt.controls.openFromMenu() : undefined}
        onOpenKeyboardShortcuts={shortcuts.showShortcutsHelpFromSettings}
      />
      <KeyboardShortcutsDialog open={shortcuts.shortcutsHelpOpen} onOpenChange={shortcuts.setShortcutsHelpOpen} />
      {shortcuts.altHintsVisible && <KeyboardShortcutHints />}
          {/* Main content */}
          <div className="flex-1 min-w-0">
        {/* Timeline */}
        <div
          ref={timelineContentRef}
          data-testid="timeline-content"
          className="mx-auto px-6 md:px-0 overflow-x-clip lg:overflow-x-visible"
        >
          <Timeline
            key={multiDay ? activeDayId : undefined}
            renderWhenEmpty={multiDay}
            items={activeDay.items}
            blockTypes={activeDay.blockTypes}
            persons={activeDay.persons || []}
            showFullPreviewText={showFullPreviewText}
            startTime={activeDay.workshop.startTime}
            targetDuration={activeDay.workshop.targetDuration}
            durationLocked={activeDay.workshop.durationLocked}
            onUpdateItem={updateItem}
            onDeleteItem={deleteItem}
            onAddItem={addItem}
            onInsertItemAfter={insertItemAfter}
            onSaveToLibrary={dataActions.handleSaveToLibrary}
            dropIndicator={dropIndicator}
            blockPlayStates={playMode.blockPlayStates}
            onOpenDialog={serverKey ? pollNow : undefined}
            date={activeDay.workshop.date}
            description={activeDay.workshop.description}
            onUpdateDescription={(desc) => updateMetadata({ description: desc })}
            onAddStartTimeClick={handleOpenStartTime}
            editingItem={editingItem}
            onEditingItemChange={setEditingItem}
            onEditFormUnsavedChange={setHasPendingFormEdits}
          />

          {/* Footer */}
          <PageFooter
            className="mt-12"
            leadingContent={serverKey ? undefined : t('planner.savedToBrowser')}
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
            items={activeDay.items}
            blockTypes={activeDay.blockTypes}
          />
        )}
      </DragOverlay>

      <PlannerDialogs
        saveTemplateDialog={dataActions.saveTemplateDialogOpen}
        onSaveTemplateDialogChange={dataActions.setSaveTemplateDialogOpen}
        templateName={dataActions.templateName}
        onTemplateNameChange={dataActions.setTemplateName}
        onSaveTemplate={dataActions.handleSaveAsTemplate}
        showDisableServerDialog={serverLink.showDisableServerDialog}
        onShowDisableServerDialogChange={serverLink.setShowDisableServerDialog}
        onConfirmDisableServer={serverLink.handleConfirmDisableServer}
        isOpeningMigratedSession={closeFlow.isOpeningMigratedSession}
        showCloseConfirmDialog={closeFlow.showCloseConfirmDialog}
        onShowCloseConfirmDialogChange={closeFlow.handleCloseConfirmOpenChange}
        onConfirmCloseSession={closeFlow.handleConfirmCloseSession}
      />

      {/* Optional in-app feedback prompt (card + dialog). Rendered last so
          its fixed-position layer sits above every planner surface; the hook
          keeps the variant `hidden` when FEEDBACK_API_URL is not configured. */}
      <FeedbackPromptLayer
        variant={feedbackPrompt.state}
        cardCountdownMs={feedbackPrompt.cardCountdownMs}
        onOpenDialogFromCard={() => feedbackPrompt.controls.openDialogFromCard()}
        controls={feedbackPrompt.controls}
      />

      {/* Slim time-distribution visualization anchored to the bottom of the
          sticky planner chrome. Opt-in (settings toggle, default OFF) AND
          desktop only; pure rendering — no DnD, no business logic. The
          setting fully unmounts the component; the lg gate below also keeps
          it from mounting on mobile / tablet. Wrapped in Suspense so the
          lazy chunk can load asynchronously. */}
      {timeVisualizationStrip && isLg && (
        <Suspense fallback={null}>
          <TimeVisualizationStrip
            items={activeDay.items}
            blockTypes={activeDay.blockTypes}
            startTime={activeDay.workshop.startTime}
            topOffsetPx={plannerHeaderHeight}
            timelineContentRef={timelineContentRef}
            liveCurrentMinute={liveCurrentMinute}
          />
        </Suspense>
      )}
      </DndContext>
      )}
    </>
  );
};
