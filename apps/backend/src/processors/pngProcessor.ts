import { supabase } from '../db/supabase.js';
import { downloadFile, uploadFile, pngPath } from '../services/storageService.js';
import { rasterizeSvgBuffer } from './svgRasterizer.js';

export async function processPngConversion(
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
  if (!svgPath) {
    throw new Error('No SVG file available for PNG conversion');
  }
  const svgBuffer = await downloadFile(svgPath);
  const pngBuffer = await rasterizeSvgBuffer(svgBuffer, 'png');

  const outPath = pngPath(assetId, asset.filename);
  await uploadFile(outPath, pngBuffer, 'image/png');

  await supabase
    .from('assets')
    .update({
      png_path: outPath,
      status: 'complete',
    })
    .eq('id', assetId);

  await supabase
    .from('jobs')
    .update({ status: 'complete' })
    .eq('id', jobId);
}
