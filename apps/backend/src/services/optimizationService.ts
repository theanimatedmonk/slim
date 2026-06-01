import { getAssetForUser, updateAssetStatus } from './assetService.js';
import { createJob } from './jobService.js';

export async function queueOptimizationForAsset(
  assetId: string,
  userId: string
): Promise<string> {
  const asset = await getAssetForUser(assetId, userId);
  if (!asset) {
    throw new Error(`Asset not found: ${assetId}`);
  }

  if (asset.status !== 'uploaded') {
    throw new Error(`Asset cannot be optimized in status: ${asset.status}`);
  }

  const job = await createJob(assetId, 'optimize');
  await updateAssetStatus(assetId, userId, 'queued');
  return job.id;
}

export async function retryFailedAsset(
  assetId: string,
  userId: string
): Promise<{ jobId: string; jobType: 'optimize' | 'convert-webp'; status: 'queued' | 'converting' }> {
  const asset = await getAssetForUser(assetId, userId);
  if (!asset) {
    throw new Error(`Asset not found: ${assetId}`);
  }

  if (asset.status !== 'failed') {
    throw new Error(`Asset cannot be retried in status: ${asset.status}`);
  }

  if (asset.original_path) {
    const job = await createJob(assetId, 'optimize');
    await updateAssetStatus(assetId, userId, 'queued');
    return { jobId: job.id, jobType: 'optimize', status: 'queued' };
  }

  if (asset.optimized_path) {
    const job = await createJob(assetId, 'convert-webp');
    await updateAssetStatus(assetId, userId, 'converting');
    return { jobId: job.id, jobType: 'convert-webp', status: 'converting' };
  }

  throw new Error('No source file available to retry');
}
