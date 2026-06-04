import { Worker } from 'bullmq';
import type { QueueJobPayload } from '@asset-optimiser/shared-types';
import { config } from '../config.js';
import { processOptimization } from '../processors/optimizeProcessor.js';
import { processPngConversion } from '../processors/pngProcessor.js';
import { processWebpConversion } from '../processors/webpProcessor.js';
import { processZipBundle } from '../processors/zipProcessor.js';
import { supabase } from '../db/supabase.js';

export const OPTIMIZATION_QUEUE_NAME = 'asset-optimization';

export function startOptimizationWorker(): Worker<QueueJobPayload> {
  const worker = new Worker<QueueJobPayload>(
    OPTIMIZATION_QUEUE_NAME,
    async (job) => {
      const payload = job.data;

      switch (payload.type) {
        case 'optimize':
          await processOptimization(payload.assetId, payload.jobId);
          break;
        case 'convert-webp':
          await processWebpConversion(payload.assetId, payload.jobId);
          break;
        case 'convert-png':
          await processPngConversion(payload.assetId, payload.jobId);
          break;
        case 'generate-zip':
          if (!payload.bundleJobId || !payload.assetIds?.length) {
            throw new Error('bundleJobId and assetIds required for zip jobs');
          }
          await processZipBundle(payload.bundleJobId, payload.assetIds);
          break;
        default:
          throw new Error(`Unknown job type: ${(payload as QueueJobPayload).type}`);
      }
    },
    {
      connection: {
        url: config.redisUrl,
        maxRetriesPerRequest: null,
      },
      concurrency: 2,
    }
  );

  worker.on('failed', async (job, err) => {
    console.error(`Job ${job?.id} failed:`, err);
    if (!job?.data) return;

    const { assetId, jobId, type } = job.data;

    if (type === 'optimize' || type === 'convert-webp' || type === 'convert-png') {
      await supabase.from('jobs').update({ status: 'failed' }).eq('id', jobId);
      await supabase.from('assets').update({ status: 'failed' }).eq('id', assetId);
    } else if (type === 'generate-zip' && job.data.bundleJobId) {
      await supabase
        .from('zip_bundles')
        .update({ status: 'failed' })
        .eq('id', job.data.bundleJobId);
    }
  });

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed (${job.data.type})`);
  });

  return worker;
}
