import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  getAssetForUser,
  listAssetsForUser,
  updateAssetStatus,
} from '../services/assetService.js';
import { createJob } from '../services/jobService.js';
import { scheduleQueueProcessing } from '../services/processQueueService.js';

export async function startOptimization(req: AuthenticatedRequest, res: Response) {
  try {
    const { assetIds } = req.body as { assetIds?: string[] };

    if (!assetIds?.length) {
      res.status(400).json({ error: 'assetIds array is required' });
      return;
    }

    const jobIds: string[] = [];

    for (const assetId of assetIds) {
      const asset = await getAssetForUser(assetId, req.userId);
      if (!asset) {
        res.status(404).json({ error: `Asset not found: ${assetId}` });
        return;
      }

      const job = await createJob(assetId, 'optimize');
      await updateAssetStatus(assetId, req.userId, 'queued');
      jobIds.push(job.id);
    }

    scheduleQueueProcessing();
    res.status(202).json({ jobIds });
  } catch (err) {
    console.error('optimize error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to queue optimization',
    });
  }
}

export async function listAllAssets(req: AuthenticatedRequest, res: Response) {
  try {
    const assets = await listAssetsForUser(req.userId);
    res.json(assets);
  } catch (err) {
    console.error('list assets error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to list assets',
    });
  }
}
