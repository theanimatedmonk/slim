import type { Request, Response } from 'express';
import { optimizationQueue } from '../queues/optimizationQueue.js';
import { getAsset, listAssets, updateAssetStatus } from '../services/assetService.js';
import { createJob } from '../services/jobService.js';

export async function startOptimization(req: Request, res: Response) {
  try {
    const { assetIds } = req.body as { assetIds?: string[] };

    if (!assetIds?.length) {
      res.status(400).json({ error: 'assetIds array is required' });
      return;
    }

    const jobIds: string[] = [];

    for (const assetId of assetIds) {
      const asset = await getAsset(assetId);
      if (!asset) {
        res.status(404).json({ error: `Asset not found: ${assetId}` });
        return;
      }

      const job = await createJob(assetId);
      await updateAssetStatus(assetId, 'queued');

      await optimizationQueue.add(
        'optimize',
        { type: 'optimize', assetId, jobId: job.id },
        { jobId: job.id }
      );

      jobIds.push(job.id);
    }

    res.status(202).json({ jobIds });
  } catch (err) {
    console.error('optimize error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to queue optimization',
    });
  }
}

export async function listAllAssets(_req: Request, res: Response) {
  try {
    const assets = await listAssets();
    res.json(assets);
  } catch (err) {
    console.error('list assets error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to list assets',
    });
  }
}
