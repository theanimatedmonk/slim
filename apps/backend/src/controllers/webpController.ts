import type { Request, Response } from 'express';
import { getAsset, updateAssetStatus } from '../services/assetService.js';
import { createJob } from '../services/jobService.js';
import { scheduleQueueProcessing } from '../services/processQueueService.js';

export async function convertToWebp(req: Request, res: Response) {
  try {
    const { assetId } = req.body as { assetId?: string };

    if (!assetId) {
      res.status(400).json({ error: 'assetId is required' });
      return;
    }

    const asset = await getAsset(assetId);
    if (!asset) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }

    const job = await createJob(assetId, 'convert-webp');
    await updateAssetStatus(assetId, 'converting');

    scheduleQueueProcessing();
    res.status(202).json({ jobId: job.id });
  } catch (err) {
    console.error('convert-webp error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to queue WebP conversion',
    });
  }
}
