import type { Asset, AssetWithJob, JobPass, OptimizationReport } from '@asset-optimiser/shared-types';
import { supabase } from '../db/supabase.js';
import { deleteFiles } from './storageService.js';

export async function createAssetRecord(params: {
  id: string;
  userId: string;
  filename: string;
  originalPath: string;
  originalSize: number;
}): Promise<Asset> {
  const { data, error } = await supabase
    .from('assets')
    .insert({
      id: params.id,
      user_id: params.userId,
      filename: params.filename,
      original_path: params.originalPath,
      original_size: params.originalSize,
      status: 'uploaded',
      complexity: 'unknown',
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create asset record');
  }

  return mapAsset(data);
}

export async function getAssetForUser(
  id: string,
  userId: string
): Promise<Asset | null> {
  const { data, error } = await supabase
    .from('assets')
    .select()
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return mapAsset(data);
}

/** @deprecated use getAssetForUser */
export async function getAsset(id: string): Promise<Asset | null> {
  const { data, error } = await supabase
    .from('assets')
    .select()
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return mapAsset(data);
}

export async function listAssetsForUser(userId: string): Promise<AssetWithJob[]> {
  const { data: assets, error } = await supabase
    .from('assets')
    .select()
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !assets) {
    throw new Error(error?.message ?? 'Failed to list assets');
  }

  const result: AssetWithJob[] = [];

  for (const row of assets) {
    const asset = mapAsset(row);
    const { data: jobs } = await supabase
      .from('jobs')
      .select()
      .eq('asset_id', asset.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const job = jobs?.[0] ? mapJob(jobs[0]) : null;
    let passes: JobPass[] = [];
    let report: OptimizationReport | null = null;

    if (job) {
      const { data: passRows } = await supabase
        .from('job_passes')
        .select()
        .eq('job_id', job.id)
        .order('pass_number', { ascending: true });
      passes = (passRows ?? []).map(mapJobPass);

      const { data: reportRow } = await supabase
        .from('optimization_reports')
        .select()
        .eq('asset_id', asset.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      report = reportRow ? mapReport(reportRow) : null;
    }

    result.push({ ...asset, job, passes, report });
  }

  return result;
}

export async function updateAssetStatus(
  id: string,
  userId: string,
  status: string
): Promise<void> {
  const { error } = await supabase
    .from('assets')
    .update({ status })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

export async function deleteAssetForUser(
  assetId: string,
  userId: string
): Promise<void> {
  const asset = await getAssetForUser(assetId, userId);
  if (!asset) {
    throw new Error('Asset not found');
  }

  const paths = [asset.original_path, asset.optimized_path, asset.webp_path].filter(
    (p): p is string => Boolean(p)
  );

  const { error } = await supabase
    .from('assets')
    .delete()
    .eq('id', assetId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);

  try {
    await deleteFiles(paths);
  } catch (err) {
    console.warn(`Storage cleanup failed for asset ${assetId}:`, err);
  }
}

function mapAsset(row: Record<string, unknown>): Asset {
  return {
    id: row.id as string,
    user_id: (row.user_id as string) ?? null,
    filename: row.filename as string,
    original_path: (row.original_path as string) ?? null,
    optimized_path: (row.optimized_path as string) ?? null,
    webp_path: (row.webp_path as string) ?? null,
    original_size: row.original_size as number,
    optimized_size: (row.optimized_size as number) ?? null,
    complexity: row.complexity as Asset['complexity'],
    status: row.status as Asset['status'],
    created_at: row.created_at as string,
  };
}

function mapJob(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    asset_id: row.asset_id as string,
    status: row.status as import('@asset-optimiser/shared-types').JobStatus,
    passes: row.passes as number,
    reduction_percent: row.reduction_percent as number,
    stabilized: row.stabilized as boolean,
    created_at: row.created_at as string,
  };
}

function mapJobPass(row: Record<string, unknown>): JobPass {
  return {
    id: row.id as string,
    job_id: row.job_id as string,
    pass_number: row.pass_number as number,
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

export { mapJob };
