import sharp from 'sharp';
import { supabase } from '../db/supabase.js';
import { downloadFile, uploadFile, webpPath } from '../services/storageService.js';

const WEBP_QUALITY = 80;

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
  if (!svgPath) {
    throw new Error('No SVG file available for WebP conversion');
  }
  const svgBuffer = await downloadFile(svgPath);

  const webpBuffer = await sharp(svgBuffer, { density: 150 })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

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
