/**
 * useSessionCloseFlow — Closing a session and opening a migrated legacy link.
 * Both may first have to confirm that unsaved changes get lost, and share one
 * confirmation dialog for that.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
interface UseSessionCloseFlowArgs {
  getHasUnsavedCloseRisk: () => boolean;
  resetSyncState: () => void;
  resetWorkshop: (options: { navigatesAway: boolean }) => void;
  onReset?: () => void;
  legacyMigrationStatus: 'new' | 'existing' | 'missing';
  migrateLegacySession: () => Promise<string | null>;
}

interface SessionCloseFlow {
  showCloseConfirmDialog: boolean;
  /** The open confirmation is about opening a migrated session, not about closing. */
  isOpeningMigratedSession: boolean;
  handleReset: () => void;
  handleCloseSessionShortcut: () => void;
  handleMigrateLegacyLink: () => Promise<string | null>;
  handleCloseConfirmOpenChange: (open: boolean) => void;
  handleConfirmCloseSession: () => void;
}

export const useSessionCloseFlow = ({
  getHasUnsavedCloseRisk,
  resetSyncState,
  resetWorkshop,
  onReset,
  legacyMigrationStatus,
  migrateLegacySession,
}: UseSessionCloseFlowArgs): SessionCloseFlow => {
  const { t } = useTranslation('common');
  const [showCloseConfirmDialog, setShowCloseConfirmDialog] = useState(false);
  const migrationConfirmationRef = useRef<((confirmed: boolean) => void) | null>(null);
  useEffect(() => () => migrationConfirmationRef.current?.(false), []);

  // Keyboard shortcuts read this ref to avoid stale closures: the Esc/X
  // shortcut fires from a callback created at mount, so we keep a live mirror
  // of "would closing now drop changes?" in a ref. The actual close still
  // flows through handleReset so dialog wiring stays consistent.
  const hasUnsavedCloseRiskRef = useRef(false);
  hasUnsavedCloseRiskRef.current = getHasUnsavedCloseRisk();

  const performCloseSession = useCallback(() => {
    // Null out all server-sync bookkeeping first so no banner or stale
    // server key survives the close (resetWorkshop only touches the data).
    resetSyncState();
    resetWorkshop({ navigatesAway: !!onReset });
    onReset?.();
  }, [resetSyncState, resetWorkshop, onReset]);

  const confirmOrClose = useCallback((hasUnsavedCloseRisk: boolean) => {
    if (hasUnsavedCloseRisk) {
      setShowCloseConfirmDialog(true);
      return;
    }
    performCloseSession();
  }, [performCloseSession]);

  const handleReset = useCallback(() => {
    confirmOrClose(getHasUnsavedCloseRisk());
  }, [confirmOrClose, getHasUnsavedCloseRisk]);

  const handleCloseSessionShortcut = useCallback(() => {
    // Read the ref, not getHasUnsavedCloseRisk — shortcuts close over a
    // callback created at mount and would otherwise pin stale state.
    confirmOrClose(hasUnsavedCloseRiskRef.current);
  }, [confirmOrClose]);

  const handleMigrateLegacyLink = useCallback(async () => {
    if (legacyMigrationStatus === 'existing' && getHasUnsavedCloseRisk()) {
      if (migrationConfirmationRef.current) return null;
      const confirmed = await new Promise<boolean>((resolve) => {
        migrationConfirmationRef.current = resolve;
        setShowCloseConfirmDialog(true);
      });
      if (!confirmed) return null;
    }
    try {
      return await migrateLegacySession();
    } catch {
      toast.error(t(legacyMigrationStatus === 'existing' ? 'planner.migratedLinkOpenError' : 'planner.permanentLinkError'));
      return null;
    }
  }, [legacyMigrationStatus, getHasUnsavedCloseRisk, migrateLegacySession, t]);

  const takeMigrationConfirmation = () => {
    const resolve = migrationConfirmationRef.current;
    migrationConfirmationRef.current = null;
    return resolve;
  };

  return {
    showCloseConfirmDialog,
    isOpeningMigratedSession: migrationConfirmationRef.current !== null,
    handleReset,
    handleCloseSessionShortcut,
    handleMigrateLegacyLink,
    handleCloseConfirmOpenChange: (open) => {
      // Track cancellations triggered by the X (Esc / overlay click).
      if (!open && showCloseConfirmDialog) {
      }
      if (!open) takeMigrationConfirmation()?.(false);
      setShowCloseConfirmDialog(open);
    },
    handleConfirmCloseSession: () => {
      setShowCloseConfirmDialog(false);
      const resolve = takeMigrationConfirmation();
      if (resolve) resolve(true);
      else performCloseSession();
    },
  };
};
