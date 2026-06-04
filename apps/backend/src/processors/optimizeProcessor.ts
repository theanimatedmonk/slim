import { optimize, type Config } from 'svgo';
import {
  calculateReductionPercent,
  isStabilized,
  MAX_OPTIMIZATION_PASSES,
} from '@asset-optimiser/shared-utils';
import { supabase } from '../db/supabase.js';
import {
  deleteFile,
  downloadFile,
  uploadFile,
  optimizedPath,
} from '../services/storageService.js';
import { validateSvgPass } from '../utils/svgValidation.js';
import { analyzeComplexity } from '../utils/complexityAnalyzer.js';

const svgoConfig = {
  multipass: true,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          removeViewBox: false,
        },
      },
    },
  ],
} satisfies Config;

export async function processOptimization(
  assetId: string,
  jobId: string
): Promise<void> {
  const { data: asset, error: assetError } = await supabase
    .from('assets')
    .select()
    .eq('id', assetId)
    .single();

  if (assetError || !asset) {
    throw new Error(`Asset not found: ${assetId}`);
  }

  await supabase.from('assets').update({ status: 'optimizing' }).eq('id', assetId);
  await supabase.from('jobs').update({ status: 'optimizing' }).eq('id', jobId);

  // Re-runs (stale reclaim / retry) must not append to existing passes — that duplicates rows in the UI.
  await supabase.from('job_passes').delete().eq('job_id', jobId);

  if (!asset.original_path) {
    throw new Error('Original SVG no longer available');
  }

  const originalPathToDelete = asset.original_path;
  const originalBuffer = await downloadFile(originalPathToDelete);
  let currentSvg = originalBuffer.toString('utf-8');
  let previousValidSvg: string | null = null;
  let previousSize = asset.original_size;
  let passNumber = 0;
  let stabilized = false;

  while (passNumber < MAX_OPTIMIZATION_PASSES && !stabilized) {
    passNumber += 1;

    const result = optimize(currentSvg, svgoConfig);
    const optimizedSvg = result.data;
    const currentSize = Buffer.byteLength(optimizedSvg, 'utf-8');

    if (!validateSvgPass(optimizedSvg, previousValidSvg ?? currentSvg)) {
      break;
    }

    const reductionFromOriginal = calculateReductionPercent(
      asset.original_size,
      currentSize
    );
    const passReduction =
      passNumber === 1
        ? reductionFromOriginal
        : calculateReductionPercent(previousSize, currentSize);

    await supabase.from('job_passes').insert({
      job_id: jobId,
      pass_number: passNumber,
      size_bytes: currentSize,
      reduction_percent: passReduction,
    });

    // Keep the lease fresh so another worker does not reclaim mid-run and duplicate passes.
    await supabase
      .from('jobs')
      .update({ claimed_at: new Date().toISOString() })
      .eq('id', jobId);

    if (isStabilized(previousSize, currentSize)) {
      stabilized = true;
    }

    previousValidSvg = optimizedSvg;
    previousSize = currentSize;
    currentSvg = optimizedSvg;

    if (passNumber >= MAX_OPTIMIZATION_PASSES) {
      stabilized = true;
    }
  }

  const finalSize = Buffer.byteLength(currentSvg, 'utf-8');
  const finalReduction = calculateReductionPercent(asset.original_size, finalSize);
  const outPath = optimizedPath(assetId, asset.filename);

  await uploadFile(outPath, Buffer.from(currentSvg, 'utf-8'), 'image/svg+xml');

  const complexity = analyzeComplexity(currentSvg, finalSize);

  await supabase.from('optimization_reports').insert({
    asset_id: assetId,
    operations: complexity.operations,
    gradients: complexity.gradients,
    path_count: complexity.pathCount,
    base64_detected: complexity.base64Detected,
    final_complexity_score: complexity.score,
  });

  try {
    await deleteFile(originalPathToDelete);
  } catch (err) {
    console.warn(`Could not delete original for ${assetId}:`, err);
  }

  await supabase
    .from('assets')
    .update({
      status: 'complete',
      optimized_path: outPath,
      optimized_size: finalSize,
      complexity: complexity.level,
      original_path: null,
    })
    .eq('id', assetId);

  await supabase
    .from('jobs')
    .update({
      status: 'complete',
      passes: passNumber,
      reduction_percent: finalReduction,
      stabilized: true,
    })
    .eq('id', jobId);
}
