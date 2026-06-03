import type { Response } from 'express';
import { MAX_BATCH_ASSETS } from '@asset-optimiser/shared-utils';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { listAssetsForUser } from '../services/assetService.js';
import { queueOptimizationForAsset } from '../services/optimizationService.js';
import { scheduleQueueProcessing } from '../services/processQueueService.js';

export async function startOptimization(req: AuthenticatedRequest, res: Response) {
  try {
    const { assetIds } = req.body as { assetIds?: string[] };

    if (!assetIds?.length) {
      res.status(400).json({ error: 'assetIds array is required' });
      return;
    }

    if (assetIds.length > MAX_BATCH_ASSETS) {
      res.status(400).json({ error: `Maximum ${MAX_BATCH_ASSETS} assets per request` });
      return;
    }

    const jobIds: string[] = [];

    for (const assetId of assetIds) {
      const jobId = await queueOptimizationForAsset(assetId, req.userId);
      jobIds.push(jobId);
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
