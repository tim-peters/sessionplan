import type { WorkshopData } from '@/types/workshop';

export interface WorkshopServerSync {
  serverKey: null;
  serverVersion: number;
  isLoadingFromServer: boolean;
  isEnablingServerMode: boolean;
  incomingUpdate: null;
  hasUnsyncedChanges: boolean;
  hasSyncError: boolean;
  enableServerMode: () => Promise<void>;
  disableServerMode: () => void;
  pollNow: () => Promise<void>;
  acceptIncomingUpdate: () => void;
  forkSession: () => Promise<void>;
  markDirty: () => void;
  loadServerSession: (_key: string) => void;
}

/** The public frontend intentionally keeps workshop data in the browser. */
export const useWorkshopServerSync = (_args: { workshop: WorkshopData }): WorkshopServerSync => ({
  serverKey: null,
  serverVersion: 0,
  isLoadingFromServer: false,
  isEnablingServerMode: false,
  incomingUpdate: null,
  hasUnsyncedChanges: false,
  hasSyncError: false,
  enableServerMode: async () => {},
  disableServerMode: () => {},
  pollNow: async () => {},
  acceptIncomingUpdate: () => {},
  forkSession: async () => {},
  markDirty: () => {},
  loadServerSession: () => {},
});
