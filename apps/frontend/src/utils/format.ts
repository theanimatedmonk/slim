export { formatBytes, calculateReductionPercent } from '@asset-optimiser/shared-utils';

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    uploaded: 'Uploaded',
    queued: 'Queued',
    optimizing: 'Optimizing',
    complete: 'Complete',
    failed: 'Failed',
    converting: 'Converting',
  };
  return labels[status] ?? status;
}

export function complexityClass(level: string): string {
  switch (level) {
    case 'simple':
      return 'asset-row__complexity--simple';
    case 'moderate':
      return 'asset-row__complexity--moderate';
    case 'complex':
      return 'asset-row__complexity--complex';
    default:
      return 'asset-row__complexity--unknown';
  }
}

/** @deprecated use complexityClass — returns design-system CSS class names */
export function complexityColor(level: string): string {
  return complexityClass(level);
}
