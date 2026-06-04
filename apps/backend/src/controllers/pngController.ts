import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { getAssetForUser, updateAssetStatus } from '../services/assetService.js';
import { createJob } from '../services/jobService.js';
import { scheduleQueueProcessing } from '../services/processQueueService.js';

export async function convertToPng(req: AuthenticatedRequest, res: Response) {
  try {
    const { assetId } = req.body as { assetId?: string };

    if (!assetId) {
      res.status(400).json({ error: 'assetId is required' });
      return;
    }

    const asset = await getAssetForUser(assetId, req.userId);
    if (!asset) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }

    const job = await createJob(assetId, 'convert-png');
    await updateAssetStatus(assetId, req.userId, 'converting');

    scheduleQueueProcessing();
    res.status(202).json({ jobId: job.id });
  } catch (err) {
    console.error('convert-png error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to queue PNG conversion',
    });
  }
}
