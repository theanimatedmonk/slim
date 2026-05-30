import {
  COMPLEXITY_SIZE_THRESHOLD_BYTES,
  GRADIENT_COUNT_THRESHOLD,
  LONG_PATH_CHAR_THRESHOLD,
  NODE_COUNT_THRESHOLD,
  scoreToComplexity,
} from '@asset-optimiser/shared-utils';
import type { ComplexityLevel } from '@asset-optimiser/shared-types';

export interface ComplexityAnalysis {
  score: number;
  level: ComplexityLevel;
  operations: string[];
  gradients: number;
  pathCount: number;
  base64Detected: boolean;
  recommendWebp: boolean;
}

export function analyzeComplexity(
  svg: string,
  fileSizeBytes: number
): ComplexityAnalysis {
  const operations: string[] = [];
  let score = 0;

  const gradients =
    (svg.match(/<linearGradient/gi) ?? []).length +
    (svg.match(/<radialGradient/gi) ?? []).length;
  const pathCount = (svg.match(/<path/gi) ?? []).length;
  const base64Detected = /href\s*=\s*["']data:image/i.test(svg);

  if (fileSizeBytes > COMPLEXITY_SIZE_THRESHOLD_BYTES) {
    operations.push('Large file size after optimization (>250KB)');
    score += 2;
  }

  const pathDataMatches = svg.match(/\bd\s*=\s*["']([^"']+)["']/gi) ?? [];
  for (const match of pathDataMatches) {
    const dataMatch = match.match(/["']([^"']+)["']/);
    const pathData = dataMatch?.[1] ?? '';
    if (pathData.length > LONG_PATH_CHAR_THRESHOLD) {
      operations.push('Long path data detected (>5000 chars)');
      score += 2;
      break;
    }
  }

  if (pathCount > NODE_COUNT_THRESHOLD) {
    operations.push(`High node count (${pathCount} paths)`);
    score += 1;
  }

  const elementCount = (svg.match(/<[a-zA-Z][^>]*>/g) ?? []).length;
  if (elementCount > NODE_COUNT_THRESHOLD) {
    operations.push(`High SVG element count (${elementCount})`);
    score += 1;
  }

  if (gradients > GRADIENT_COUNT_THRESHOLD) {
    operations.push(`Heavy gradients (${gradients})`);
    score += 1;
  }

  if (/feGaussianBlur/i.test(svg)) {
    operations.push('Gaussian blur filter detected');
    score += 1;
  }

  if (/<mask/i.test(svg)) {
    operations.push('Mask elements detected');
    score += 1;
  }

  if (/<clipPath/i.test(svg)) {
    operations.push('Clip paths detected');
    score += 1;
  }

  if (base64Detected) {
    operations.push('Embedded base64 raster image detected');
    score += 3;
  }

  const level = scoreToComplexity(score);
  const recommendWebp = level === 'complex' || base64Detected;

  return {
    score,
    level,
    operations,
    gradients,
    pathCount,
    base64Detected,
    recommendWebp,
  };
}
