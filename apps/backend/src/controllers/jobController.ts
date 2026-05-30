import type { Request, Response } from 'express';
import { getJobStatus } from '../services/jobService.js';
import { createSignedDownloadUrl } from '../services/storageService.js';
import { supabase } from '../db/supabase.js';
import { config } from '../config.js';

export async function getJob(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const status = await getJobStatus(id);

    if (!status) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.json(status);
  } catch (err) {
    console.error('job status error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to fetch job status',
    });
  }
}

export async function downloadBundle(req: Request, res: Response) {
  try {
    const { jobId } = req.params;

    const { data: zipRow } = await supabase
      .from('zip_bundles')
      .select('storage_path')
      .eq('id', jobId)
      .single();

    if (!zipRow?.storage_path) {
      res.status(404).json({ error: 'Bundle not found or still processing' });
      return;
    }

    const signedUrl = await createSignedDownloadUrl(zipRow.storage_path);
    res.json({ downloadUrl: signedUrl });
  } catch (err) {
    console.error('download error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to generate download',
    });
  }
}

export async function requestBundleDownload(req: Request, res: Response) {
  try {
    const { assetIds } = req.body as { assetIds?: string[] };

    if (!assetIds?.length) {
      res.status(400).json({ error: 'assetIds array is required' });
      return;
    }

    const bundleJobId = crypto.randomUUID();

    const { optimizationQueue } = await import('../queues/optimizationQueue.js');
    await optimizationQueue.add(
      'generate-zip',
      {
        type: 'generate-zip',
        assetId: assetIds[0],
        jobId: bundleJobId,
        bundleJobId,
        assetIds,
      },
      { jobId: bundleJobId }
    );

    await supabase.from('zip_bundles').insert({
      id: bundleJobId,
      asset_ids: assetIds,
      status: 'processing',
    });

    res.status(202).json({ jobId: bundleJobId });
  } catch (err) {
    console.error('bundle request error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to queue bundle generation',
    });
  }
}
