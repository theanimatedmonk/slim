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

export function complexityColor(level: string): string {
  switch (level) {
    case 'simple':
      return 'text-emerald-400 bg-emerald-400/10';
    case 'moderate':
      return 'text-amber-400 bg-amber-400/10';
    case 'complex':
      return 'text-rose-400 bg-rose-400/10';
    default:
      return 'text-gray-400 bg-gray-400/10';
  }
}
