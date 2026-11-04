import type { UpdateServerFailureReason } from '@/lib/workshopServer';
import {
  IncomingUpdateBanner,
  ReadOnlyChangesBanner,
  SessionDeletedBanner,
  SyncRejectedBanner,
  UnsyncedChangesBanner,
} from './SessionBanners';

interface SyncStatusBannersProps {
  serverKey: string | null;
  incomingUpdate: boolean;
  canEditServerSession: boolean;
  hasUnsyncedChanges: boolean;
  syncFailureReason: UpdateServerFailureReason | null;
  onAcceptIncomingUpdate: () => void;
  onCreateLocalCopy: () => void;
  onDownload: () => void;
}

/** The banner, if any, for the sync state of a Dynamic Link session. */
export const SyncStatusBanners = ({
  serverKey,
  incomingUpdate,
  canEditServerSession,
  hasUnsyncedChanges,
  syncFailureReason,
  onAcceptIncomingUpdate,
  onCreateLocalCopy,
  onDownload,
}: SyncStatusBannersProps) => {
  if (incomingUpdate) {
    return (
      <IncomingUpdateBanner
        onAccept={onAcceptIncomingUpdate}
        onCreateLocalCopy={onCreateLocalCopy}
        serverKey={serverKey}
      />
    );
  }
  if (!serverKey) return null;
  if (syncFailureReason === 'deleted') return <SessionDeletedBanner onCreateLocalCopy={onCreateLocalCopy} />;
  if ((!canEditServerSession && hasUnsyncedChanges) || syncFailureReason === 'forbidden') {
    return <ReadOnlyChangesBanner onCreateLocalCopy={onCreateLocalCopy} />;
  }
  if (syncFailureReason === 'rejected') return <SyncRejectedBanner onDownload={onDownload} />;
  if (syncFailureReason === 'server') return <UnsyncedChangesBanner onDownload={onDownload} />;
  return null;
};
