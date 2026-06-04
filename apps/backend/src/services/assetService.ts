import type { Asset, AssetListItem, AssetWithJob, JobIteration, OptimizationReport } from '@asset-optimiser/shared-types';
import { supabase } from '../db/supabase.js';
import { dedupeJobIterations } from '../utils/dedupeJobIterations.js';
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

/**
 * Returns how many of the given asset ids are owned by the user, in a single
 * query. Use to authorize batch operations without N round-trips.
 */
export async function countAssetsOwnedByUser(
  assetIds: string[],
  userId: string
): Promise<number> {
  if (!assetIds.length) return 0;
  const uniqueIds = [...new Set(assetIds)];

  const { count, error } = await supabase
    .from('assets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('id', uniqueIds);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Fetch many of a user's assets in a single query (order not guaranteed). */
export async function getAssetsForUser(
  assetIds: string[],
  userId: string
): Promise<Asset[]> {
  if (!assetIds.length) return [];
  const uniqueIds = [...new Set(assetIds)];

  const { data, error } = await supabase
    .from('assets')
    .select()
    .eq('user_id', userId)
    .in('id', uniqueIds);

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to fetch assets');
  }

  return data.map(mapAsset);
}

export async function listAssetsForUser(userId: string): Promise<AssetListItem[]> {
  const { data: assets, error } = await supabase
    .from('assets')
    .select()
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !assets) {
    throw new Error(error?.message ?? 'Failed to list assets');
  }

  const completeIds = assets
    .filter((row) => row.status === 'complete')
    .map((row) => row.id as string);

  const base64ByAssetId = new Map<string, boolean>();

  if (completeIds.length > 0) {
    const { data: reports } = await supabase
      .from('optimization_reports')
      .select('asset_id, base64_detected')
      .in('asset_id', completeIds);

    for (const row of reports ?? []) {
      base64ByAssetId.set(row.asset_id as string, row.base64_detected as boolean);
    }
  }

  return assets.map((row) => {
    const asset = mapAsset(row);
    return {
      ...asset,
      base64_detected: completeIds.includes(asset.id)
        ? (base64ByAssetId.get(asset.id) ?? false)
        : null,
    };
  });
}

export async function getAssetWithDetailsForUser(
  assetId: string,
  userId: string
): Promise<AssetWithJob | null> {
  const asset = await getAssetForUser(assetId, userId);
  if (!asset) return null;

  const { data: jobs } = await supabase
    .from('jobs')
    .select()
    .eq('asset_id', asset.id)
    .order('created_at', { ascending: false })
    .limit(1);

  const job = jobs?.[0] ? mapJob(jobs[0]) : null;
  let iterations: JobIteration[] = [];
  let report: OptimizationReport | null = null;

  if (job) {
    // Passes and the report are independent — fetch them concurrently.
    const [passesResult, reportResult] = await Promise.all([
      supabase
        .from('job_passes')
        .select()
        .eq('job_id', job.id)
        .order('pass_number', { ascending: true }),
      supabase
        .from('optimization_reports')
        .select()
        .eq('asset_id', asset.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
    ]);

    iterations = dedupeJobIterations((passesResult.data ?? []).map(mapJobIteration));
    report = reportResult.data ? mapReport(reportResult.data) : null;
  }

  return { ...asset, job, iterations, report };
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

export { mapJob };
