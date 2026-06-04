import type { JobIteration } from '@asset-optimiser/shared-types';

/** Legacy rows may contain duplicate pass_number if a job was reclaimed mid-run. */
export function dedupeJobIterations(iterations: JobIteration[]): JobIteration[] {
  const byPass = new Map<number, JobIteration>();
  for (const iteration of iterations) {
    const existing = byPass.get(iteration.iteration_number);
    if (!existing || iteration.created_at > existing.created_at) {
      byPass.set(iteration.iteration_number, iteration);
    }
  }
  return [...byPass.values()].sort(
    (a, b) => a.iteration_number - b.iteration_number
  );
}
