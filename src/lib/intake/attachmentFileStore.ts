/**
 * Session-only File store for intake attachments.
 *
 * localStorage holds metadata only (quota / PII). Binary File objects stay in memory keyed by
 * brief id until Submit to Workfront Que uploads them, or until the tab is closed.
 */

const byBrief = new Map<string, Map<string, File>>();

function ensureBrief(briefId: string): Map<string, File> {
  let map = byBrief.get(briefId);
  if (!map) {
    map = new Map();
    byBrief.set(briefId, map);
  }
  return map;
}

export function storeAttachmentFile(
  briefId: string,
  attachmentId: string,
  file: File,
): void {
  ensureBrief(briefId).set(attachmentId, file);
}

export function storeAttachmentFiles(
  briefId: string,
  pairs: Array<{ attachmentId: string; file: File }>,
): void {
  const map = ensureBrief(briefId);
  for (const pair of pairs) {
    map.set(pair.attachmentId, pair.file);
  }
}

export function getAttachmentFile(
  briefId: string,
  attachmentId: string,
): File | undefined {
  return byBrief.get(briefId)?.get(attachmentId);
}

export function listAttachmentFiles(briefId: string): File[] {
  const map = byBrief.get(briefId);
  return map ? Array.from(map.values()) : [];
}

export function hasAttachmentFile(briefId: string, attachmentId: string): boolean {
  return Boolean(byBrief.get(briefId)?.has(attachmentId));
}

export function removeAttachmentFile(briefId: string, attachmentId: string): void {
  byBrief.get(briefId)?.delete(attachmentId);
}

export function clearBriefAttachments(briefId: string): void {
  byBrief.delete(briefId);
}

/** Match a re-attached File to an existing metadata row by exact file name. */
export function rebindAttachmentFileByName(
  briefId: string,
  fileName: string,
  file: File,
  attachmentIds: string[],
): string | null {
  const map = ensureBrief(briefId);
  for (const id of attachmentIds) {
    if (!map.has(id)) {
      // Prefer first missing slot; caller passes ids in attachment order.
      map.set(id, file);
      return id;
    }
  }
  // All slots filled — store under a synthetic key by name for upload iteration.
  const synthetic = `name:${fileName}`;
  map.set(synthetic, file);
  return synthetic;
}
