import type { ComplexityLevel } from '@asset-optimiser/shared-types';

export const MAX_OPTIMIZATION_PASSES = 8;
/** Largest SVG we accept for upload/optimization. Guards against OOM/DoS. */
export const MAX_UPLOAD_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const STABILIZATION_THRESHOLD_PERCENT = 1;

/** Max number of asset ids accepted in a single batch request (optimize/preview/bundle). */
export const MAX_BATCH_ASSETS = 100;
/** Hard cap on raster dimensions when converting SVG → WebP/PNG (guards against decompression bombs). */
export const MAX_RASTER_DIMENSION = 4096;
export const COMPLEXITY_SIZE_THRESHOLD_BYTES = 250 * 1024;
export const LONG_PATH_CHAR_THRESHOLD = 5000;
export const NODE_COUNT_THRESHOLD = 150;
export const GRADIENT_COUNT_THRESHOLD = 8;

export const STORAGE_BUCKETS = {
  originals: 'originals',
  optimized: 'optimized',
  webp: 'webp',
  png: 'png',
  zips: 'zips',
  temp: 'temp',
} as const;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function calculateReductionPercent(
  original: number,
  current: number
): number {
  if (original <= 0) return 0;
  return Math.round(((original - current) / original) * 1000) / 10;
}

export function isStabilized(
  previousSize: number,
  currentSize: number
): boolean {
  if (previousSize <= 0) return true;
  const delta = previousSize - currentSize;
  const deltaPercent = (delta / previousSize) * 100;
  return deltaPercent < STABILIZATION_THRESHOLD_PERCENT;
}

export function scoreToComplexity(score: number): ComplexityLevel {
  if (score >= 5) return 'complex';
  if (score >= 2) return 'moderate';
  return 'simple';
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function buildStoragePath(
  folder: string,
  assetId: string,
  filename: string
): string {
  return `${folder}/${assetId}/${sanitizeFilename(filename)}`;
}
