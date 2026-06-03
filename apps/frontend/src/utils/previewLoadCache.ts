/** Signed URLs rotate tokens; pathname is stable for the same stored file. */
export function previewSourceKey(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split('?')[0] ?? url;
  }
}

const loadedSourceKeys = new Set<string>();

export function isPreviewSourceLoaded(sourceKey: string): boolean {
  return loadedSourceKeys.has(sourceKey);
}

export function markPreviewSourceLoaded(sourceKey: string): void {
  loadedSourceKeys.add(sourceKey);
}
