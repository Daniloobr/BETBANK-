export const LEGACY_STORAGE_KEY = 'betbank-intelligence-v1';

export function readLegacyBackup(storage) {
  try {
    const value = storage?.getItem(LEGACY_STORAGE_KEY);
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function hasLegacyBackup(storage) {
  return readLegacyBackup(storage) !== null;
}

export function downloadLegacyBackup(raw, { documentRef = globalThis.document, urlApi = globalThis.URL, schedule = globalThis.setTimeout } = {}) {
  if (typeof raw !== 'string' || !raw || !documentRef?.createElement || !urlApi?.createObjectURL) return false;
  const blob = new Blob([raw], { type: 'application/json;charset=utf-8' });
  const href = urlApi.createObjectURL(blob);
  const anchor = documentRef.createElement('a');
  anchor.href = href;
  anchor.download = 'betbank-backup-legado.json';
  anchor.click();
  schedule?.(() => urlApi.revokeObjectURL?.(href), 1000);
  return true;
}
