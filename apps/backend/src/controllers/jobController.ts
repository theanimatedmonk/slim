import type { Request, Response } from 'express';
import { getJobStatus } from '../services/jobService.js';
import { createSignedDownloadUrl } from '../services/storageService.js';
import { supabase } from '../db/supabase.js';
import { scheduleQueueProcessing } from '../services/processQueueService.js';
function routeParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export async function getJob(req: Request, res: Response) {
  try {
    const id = routeParam(req.params.id);
    if (!id) {
      res.status(400).json({ error: 'Job id is required' });
      return;
    }
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
    const jobId = routeParam(req.params.jobId);
    if (!jobId) {
      res.status(400).json({ error: 'Job id is required' });
      return;
    }

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

    await supabase.from('zip_bundles').insert({
      id: bundleJobId,
      asset_ids: assetIds,
      status: 'processing',
    });

    scheduleQueueProcessing();
    res.status(202).json({ jobId: bundleJobId });
  } catch (err) {
    console.error('bundle request error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to queue bundle generation',
    });
  }
}
