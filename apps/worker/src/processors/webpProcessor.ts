import { supabase } from '../db/supabase.js';
import { downloadFile, uploadFile, webpPath } from '../services/storageService.js';
import { rasterizeSvgBuffer } from './svgRasterizer.js';

export async function processWebpConversion(
  assetId: string,
  jobId: string
): Promise<void> {
  const { data: asset, error } = await supabase
    .from('assets')
    .select()
    .eq('id', assetId)
    .single();

  if (error || !asset) {
    throw new Error(`Asset not found: ${assetId}`);
  }

  await supabase.from('jobs').update({ status: 'converting' }).eq('id', jobId);

  const svgPath = asset.optimized_path ?? asset.original_path;
  const svgBuffer = await downloadFile(svgPath);

  const webpBuffer = await rasterizeSvgBuffer(svgBuffer, 'webp');

  const outPath = webpPath(assetId, asset.filename);
  await uploadFile(outPath, webpBuffer, 'image/webp');

  await supabase
    .from('assets')
    .update({
      webp_path: outPath,
      status: 'complete',
    })
    .eq('id', assetId);

  await supabase
    .from('jobs')
    .update({ status: 'complete' })
    .eq('id', jobId);
}
