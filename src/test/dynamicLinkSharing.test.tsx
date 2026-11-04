import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HeaderActionButtons } from '@/modules/planner/HeaderActionButtons';
import { IncomingUpdateBanner } from '@/modules/planner/SessionBanners';
import { installClipboardMock } from './test-helpers';

const device = vi.hoisted(() => ({ mobile: false }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => device.mobile }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const editorUrl = 'http://localhost:3000/?id=new#k=secret&w=permission';
const readerUrl = 'http://localhost:3000/?id=new#k=secret';
const baseProps = () => ({
  playMode: { isActive: false, activate: vi.fn(), deactivate: vi.fn() },
  onReset: vi.fn(), serverKey: 'new', isEnablingServerMode: false,
  onToggleServerMode: vi.fn(async () => editorUrl),
  getEditorShareUrl: () => editorUrl, getReadOnlyShareUrl: () => readerUrl,
  canEditServerSession: true, isLegacyServerSession: false,
  onMigrateLegacyLink: vi.fn(async () => editorUrl), legacyMigrationStatus: 'new' as const,
  snapshotUrl: 'http://localhost:3000/#data=example', dateLocale: 'de-DE',
  canUndo: false, onUndo: vi.fn(), onMenuClick: vi.fn(),
});
let clipboard: ReturnType<typeof vi.fn>;
beforeEach(() => { device.mobile = false; clipboard = installClipboardMock(); });
afterEach(cleanup);
const shareButton = () => document.querySelector<HTMLButtonElement>('button[data-share-trigger]')!;

describe('consistent sharing controls', () => {
  it('defaults to view sharing and retains the editor choice across closing and reopening the menu', async () => {
    render(<HeaderActionButtons {...baseProps()} />);
    fireEvent.click(shareButton());
    await waitFor(() => expect(clipboard).toHaveBeenLastCalledWith(readerUrl));
    expect(screen.getByRole('switch', { name: 'planner.allowEditing' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('switch', { name: 'planner.allowEditing' }));
    fireEvent.click(screen.getByRole('button', { name: 'planner.copyEditorLink' }));
    await waitFor(() => expect(clipboard).toHaveBeenLastCalledWith(editorUrl));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('switch', { name: 'planner.allowEditing' })).not.toBeInTheDocument());
    fireEvent.click(shareButton());
    await waitFor(() => expect(clipboard).toHaveBeenLastCalledWith(editorUrl));
    fireEvent.click(screen.getByTitle('planner.shareOptions'));
    expect(screen.getByRole('switch', { name: 'planner.allowEditing' })).toBeChecked();
  });

  it('resets the sharing choice when changing sessions and never grants editing to readers', async () => {
    const props = baseProps(); const view = render(<HeaderActionButtons {...props} />);
    fireEvent.click(screen.getByTitle('planner.shareOptions'));
    fireEvent.click(screen.getByRole('switch', { name: 'planner.allowEditing' }));
    view.rerender(<HeaderActionButtons {...props} serverKey="other" />);
    expect(screen.getByRole('switch', { name: 'planner.allowEditing' })).not.toBeChecked();
    view.rerender(<HeaderActionButtons {...props} serverKey="reader" canEditServerSession={false} />);
    expect(screen.queryByRole('switch', { name: 'planner.allowEditing' })).not.toBeInTheDocument();
    fireEvent.click(shareButton());
    await waitFor(() => expect(clipboard).toHaveBeenLastCalledWith(readerUrl));
    view.rerender(<HeaderActionButtons {...props} serverKey="reader" canEditServerSession />);
    expect(screen.getByRole('switch', { name: 'planner.allowEditing' })).not.toBeChecked();
  });

  it('does not carry a copied confirmation over to a different session', async () => {
    const props = baseProps(); const view = render(<HeaderActionButtons {...props} />);
    fireEvent.click(shareButton());
    await waitFor(() => expect(screen.getByText('planner.copyReaderLinkCopied')).toBeInTheDocument());
    view.rerender(<HeaderActionButtons {...props} serverKey="other" getReadOnlyShareUrl={() => readerUrl.replace('id=new', 'id=other')} />);
    expect(screen.queryByText('planner.copyReaderLinkCopied')).not.toBeInTheDocument();
    expect(screen.getByText('planner.copyReaderLink')).toBeInTheDocument();
  });

  it('uses the same choice on the mobile share button', async () => {
    device.mobile = true; render(<HeaderActionButtons {...baseProps()} />);
    fireEvent.click(shareButton());
    await waitFor(() => expect(clipboard).toHaveBeenLastCalledWith(readerUrl));
    fireEvent.click(screen.getByRole('switch', { name: 'planner.allowEditing' }));
    fireEvent.click(shareButton());
    await waitFor(() => expect(clipboard).toHaveBeenLastCalledWith(editorUrl));
  });

  it('copies the newly activated view URL instead of an old callback URL', async () => {
    const props = baseProps();
    render(<HeaderActionButtons {...props} serverKey={null} canEditServerSession={false} getReadOnlyShareUrl={() => 'http://localhost:3000/#data=old'} />);
    fireEvent.click(screen.getByTitle('planner.shareOptions'));
    fireEvent.click(screen.getByRole('switch', { name: 'planner.permanentLink*' }));
    await waitFor(() => expect(clipboard).toHaveBeenLastCalledWith(readerUrl));
  });

  it('copies the migration result and shows copied only after clipboard success; failure can be retried without migration', async () => {
    const props = baseProps();
    let resolveCopy: () => void;
    clipboard.mockImplementationOnce(() => new Promise<void>(resolve => { resolveCopy = resolve; }));
    const view = render(<HeaderActionButtons {...props} serverKey="legacy" isLegacyServerSession />);
    fireEvent.click(screen.getByTitle('planner.shareOptions'));
    fireEvent.click(screen.getByRole('button', { name: 'planner.migrateLegacyLink' }));
    await waitFor(() => expect(clipboard).toHaveBeenLastCalledWith(readerUrl));
    expect(screen.queryByText('planner.copyReaderLinkCopied')).not.toBeInTheDocument();
    view.rerender(<HeaderActionButtons {...props} />);
    await act(async () => resolveCopy());
    expect(screen.getByText('planner.copyReaderLinkCopied')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'planner.allowEditing' }));
    clipboard.mockRejectedValueOnce(new Error('Clipboard denied'));
    fireEvent.click(screen.getByRole('button', { name: 'planner.copyEditorLink' }));
    await waitFor(() => expect(screen.getByText('planner.copyEditorLink')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'planner.copyEditorLink' }));
    await waitFor(() => expect(screen.getByText('planner.copyEditorLinkCopied')).toBeInTheDocument());
    expect(clipboard).toHaveBeenLastCalledWith(editorUrl);
    expect(props.onMigrateLegacyLink).toHaveBeenCalledTimes(1);
  });
});

it('places the read-only chip first in the action bar and removes it for a local copy', () => {
  const props = baseProps();
  const view = render(<HeaderActionButtons {...props} isReadOnly />);
  const chip = screen.getByText('planner.readOnlyChip');
  expect(chip).toHaveClass('print:hidden');
  const playTrigger = view.container.querySelector('[data-play-mode-trigger]');
  expect(playTrigger).not.toBeNull();
  // The mobile sidebar trigger is outside the action group. Assert the
  // intended reading order without depending on that extra wrapper/button.
  expect(chip.compareDocumentPosition(playTrigger!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.getByLabelText('planner.readOnlyChipDescription')).toBeInTheDocument();
  view.rerender(<HeaderActionButtons {...props} isReadOnly={false} />);
  expect(screen.queryByText('planner.readOnlyChip')).not.toBeInTheDocument();
});

it('offers a local copy for a conflict', () => {
  const onCreateLocalCopy = vi.fn();
  render(<IncomingUpdateBanner onAccept={vi.fn()} onCreateLocalCopy={onCreateLocalCopy} />);
  fireEvent.click(screen.getByRole('button', { name: 'planner.incomingUpdateLocalCopy' }));
  expect(onCreateLocalCopy).toHaveBeenCalledOnce();
});
