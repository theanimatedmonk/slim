import { supabase } from '../db/supabase.js';
import { processOptimization } from '../processors/optimizeProcessor.js';
import { processPngConversion } from '../processors/pngProcessor.js';
import { processWebpConversion } from '../processors/webpProcessor.js';
import { processZipBundle } from '../processors/zipProcessor.js';

export type JobType = 'optimize' | 'convert-webp' | 'convert-png';

interface QueuedJobRow {
  id: string;
  asset_id: string;
  job_type: string;
}

interface ZipBundleRow {
  id: string;
  asset_ids: string[];
}

const MAX_JOBS_PER_RUN = 3;
const MAX_RUN_MS = 25_000;
/** A claimed job/bundle older than this is presumed dead and may be reclaimed. */
const STALE_LEASE_MS = 5 * 60_000;

function staleCutoffIso(): string {
  return new Date(Date.now() - STALE_LEASE_MS).toISOString();
}

export async function processQueue(): Promise<{
  processedJobs: number;
  processedBundles: number;
}> {
  const started = Date.now();
  let processedJobs = 0;
  let processedBundles = 0;

  while (
    processedJobs < MAX_JOBS_PER_RUN &&
    Date.now() - started < MAX_RUN_MS
  ) {
    const job = await claimNextJob();
    if (!job) break;

    try {
      await runJob(job);
      processedJobs += 1;
    } catch (err) {
      console.error(`Job ${job.id} failed:`, err);
      await supabase.from('jobs').update({ status: 'failed' }).eq('id', job.id);
      await supabase.from('assets').update({ status: 'failed' }).eq('id', job.asset_id);
    }
  }

  if (Date.now() - started < MAX_RUN_MS) {
    const bundle = await claimNextZipBundle();
    if (bundle) {
      try {
        await processZipBundle(bundle.id, bundle.asset_ids);
        processedBundles += 1;
      } catch (err) {
        console.error(`Zip bundle ${bundle.id} failed:`, err);
        await supabase
          .from('zip_bundles')
          .update({ status: 'failed' })
          .eq('id', bundle.id);
      }
    }
  }

  return { processedJobs, processedBundles };
}

async function claimNextJob(): Promise<QueuedJobRow | null> {
  // 1. Prefer a freshly queued job.
  const { data: queued } = await supabase
    .from('jobs')
    .select('id, asset_id, job_type')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1);

  const candidate = queued?.[0] as QueuedJobRow | undefined;
  if (candidate) {
    const { data: claimed } = await supabase
      .from('jobs')
      .update({ status: 'optimizing', claimed_at: new Date().toISOString() })
      .eq('id', candidate.id)
      .eq('status', 'queued')
      .select('id, asset_id, job_type')
      .single();

    if (claimed) return claimed as QueuedJobRow;
  }

  // 2. Otherwise reclaim a job whose worker died mid-run (stuck 'optimizing').
  const { data: stale } = await supabase
    .from('jobs')
    .select('id, asset_id, job_type')
    .eq('status', 'optimizing')
    .lt('claimed_at', staleCutoffIso())
    .order('claimed_at', { ascending: true })
    .limit(1);

  const staleCandidate = stale?.[0] as QueuedJobRow | undefined;
  if (!staleCandidate) return null;

  const { data: reclaimed } = await supabase
    .from('jobs')
    .update({ claimed_at: new Date().toISOString() })
    .eq('id', staleCandidate.id)
    .eq('status', 'optimizing')
    .lt('claimed_at', staleCutoffIso())
    .select('id, asset_id, job_type')
    .single();

  return (reclaimed as QueuedJobRow) ?? null;
}

async function claimNextZipBundle(): Promise<ZipBundleRow | null> {
  // 1. Prefer a freshly queued bundle.
  const { data: rows } = await supabase
    .from('zip_bundles')
    .select('id, asset_ids')
    .eq('status', 'processing')
    .order('created_at', { ascending: true })
    .limit(1);

  const candidate = rows?.[0] as ZipBundleRow | undefined;
  if (candidate) {
    const { data: claimed } = await supabase
      .from('zip_bundles')
      .update({ status: 'active', claimed_at: new Date().toISOString() })
      .eq('id', candidate.id)
      .eq('status', 'processing')
      .select('id, asset_ids')
      .single();

    if (claimed) return claimed as ZipBundleRow;
  }

  // 2. Reclaim a bundle whose worker died mid-run (stuck 'active').
  const { data: stale } = await supabase
    .from('zip_bundles')
    .select('id, asset_ids')
    .eq('status', 'active')
    .lt('claimed_at', staleCutoffIso())
    .order('claimed_at', { ascending: true })
    .limit(1);

  const staleCandidate = stale?.[0] as ZipBundleRow | undefined;
  if (!staleCandidate) return null;

  const { data: reclaimed } = await supabase
    .from('zip_bundles')
    .update({ claimed_at: new Date().toISOString() })
    .eq('id', staleCandidate.id)
    .eq('status', 'active')
    .lt('claimed_at', staleCutoffIso())
    .select('id, asset_ids')
    .single();

  return (reclaimed as ZipBundleRow) ?? null;
}

async function runJob(job: QueuedJobRow): Promise<void> {
  const jobType = (job.job_type ?? 'optimize') as JobType;

  if (jobType === 'convert-webp') {
    await processWebpConversion(job.asset_id, job.id);
    return;
  }

  if (jobType === 'convert-png') {
    await processPngConversion(job.asset_id, job.id);
    return;
  }

  await processOptimization(job.asset_id, job.id);
}

/** Fire-and-forget queue processing (local dev + faster UX after optimize). */
export function scheduleQueueProcessing(): void {
  setImmediate(() => {
    processQueue().catch((err) => console.error('Background queue error:', err));
  });
}
