import archiver from 'archiver';
import { PassThrough } from 'node:stream';
import { supabase } from '../db/supabase.js';
import { downloadFile, uploadFile, zipPath } from '../services/storageService.js';

interface AssetRow {
  id: string;
  filename: string;
  original_path: string;
  optimized_path: string | null;
  webp_path: string | null;
  original_size: number;
  optimized_size: number | null;
  complexity: string;
}

export async function processZipBundle(
  bundleJobId: string,
  assetIds: string[]
): Promise<void> {
  const { data: assets, error } = await supabase
    .from('assets')
    .select()
    .in('id', assetIds);

  if (error || !assets?.length) {
    throw new Error('No assets found for bundle');
  }

  const archive = archiver('zip', { zlib: { level: 9 } });
  const passThrough = new PassThrough();
  const chunks: Buffer[] = [];

  passThrough.on('data', (chunk: Buffer) => chunks.push(chunk));

  const zipDone = new Promise<Buffer>((resolve, reject) => {
    passThrough.on('end', () => resolve(Buffer.concat(chunks)));
    passThrough.on('error', reject);
    archive.on('error', reject);
  });

  archive.pipe(passThrough);

  const report: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    assets: [] as unknown[],
  };

  for (const asset of assets as AssetRow[]) {
    const svgPath = asset.optimized_path ?? asset.original_path;
    const svgBuffer = await downloadFile(svgPath);
    archive.append(svgBuffer, { name: `svg/${asset.filename}` });

    if (asset.webp_path) {
      const webpBuffer = await downloadFile(asset.webp_path);
      const webpName = asset.filename.replace(/\.svg$/i, '.webp');
      archive.append(webpBuffer, { name: `webp/${webpName}` });
    }

    const { data: optReport } = await supabase
      .from('optimization_reports')
      .select()
      .eq('asset_id', asset.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    (report.assets as unknown[]).push({
      id: asset.id,
      filename: asset.filename,
      originalSize: asset.original_size,
      optimizedSize: asset.optimized_size,
      complexity: asset.complexity,
      report: optReport,
    });
  }

  archive.append(JSON.stringify(report, null, 2), { name: 'report.json' });
  await archive.finalize();

  const zipBuffer = await zipDone;
  const storagePath = zipPath(bundleJobId);
  await uploadFile(storagePath, zipBuffer, 'application/zip');

  await supabase
    .from('zip_bundles')
    .update({ storage_path: storagePath, status: 'complete' })
    .eq('id', bundleJobId);
}
