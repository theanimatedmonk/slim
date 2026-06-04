import type { Job, JobIteration, JobStatusResponse, OptimizationReport } from '@asset-optimiser/shared-types';
import { supabase } from '../db/supabase.js';
import { dedupeJobIterations } from '../utils/dedupeJobIterations.js';
import { getAssetForUser } from './assetService.js';

export async function createJob(
  assetId: string,
  jobType: 'optimize' | 'convert-webp' = 'optimize'
): Promise<Job> {
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      asset_id: assetId,
      job_type: jobType,
      status: 'queued',
      passes: 0,
      reduction_percent: 0,
      stabilized: false,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create job');
  }

  return mapJob(data);
}

export async function getJobStatus(
  jobId: string,
  userId: string
): Promise<JobStatusResponse | null> {
  const { data: jobRow, error } = await supabase
    .from('jobs')
    .select()
    .eq('id', jobId)
    .single();

  if (error || !jobRow) return null;

  const job = mapJob(jobRow);
  const asset = await getAssetForUser(job.asset_id, userId);
  if (!asset) return null;

  const { data: passRows } = await supabase
    .from('job_passes')
    .select()
    .eq('job_id', jobId)
    .order('pass_number', { ascending: true });

  const { data: reportRow } = await supabase
    .from('optimization_reports')
    .select()
    .eq('asset_id', job.asset_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return {
    job,
    asset,
    iterations: dedupeJobIterations((passRows ?? []).map(mapJobIteration)),
    report: reportRow ? mapReport(reportRow) : null,
  };
}

function mapJob(row: Record<string, unknown>): Job {
  return {
    id: row.id as string,
    asset_id: row.asset_id as string,
    status: row.status as Job['status'],
    iterations: row.passes as number,
    reduction_percent: row.reduction_percent as number,
    stabilized: row.stabilized as boolean,
    created_at: row.created_at as string,
  };
}

function mapJobIteration(row: Record<string, unknown>): JobIteration {
  return {
    id: row.id as string,
    job_id: row.job_id as string,
    iteration_number: row.pass_number as number,
    size_bytes: row.size_bytes as number,
    reduction_percent: row.reduction_percent as number,
    created_at: row.created_at as string,
  };
}

function mapReport(row: Record<string, unknown>): OptimizationReport {
  return {
    id: row.id as string,
    asset_id: row.asset_id as string,
    operations: (row.operations as string[]) ?? [],
    gradients: row.gradients as number,
    path_count: row.path_count as number,
    base64_detected: row.base64_detected as boolean,
    final_complexity_score: row.final_complexity_score as number,
    created_at: row.created_at as string,
  };
}
