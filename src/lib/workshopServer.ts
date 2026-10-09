export type SessionUnavailableReason = 'unavailable';

export const getKeyFromSearch = (): null => null;
export const clearKeyFromUrl = (): void => {
  const url = new URL(window.location.href);
  url.searchParams.delete('id');
  window.history.replaceState(null, '', url.toString());
};
export const deleteServerSession = async (_key: string): Promise<void> => {};
export const fetchServerSessionStatus = async (_key: string): Promise<any> => ({ status: 'unavailable', reason: 'unavailable' });
