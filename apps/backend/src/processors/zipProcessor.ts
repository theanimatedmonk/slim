import archiver from 'archiver';
import { PassThrough } from 'node:stream';
import { supabase } from '../db/supabase.js';
import { downloadFile, uploadFile, zipPath } from '../services/storageService.js';
import {
  buildBundleReportPdf,
  buildReportRows,
} from '../utils/bundleReportPdf.js';

interface AssetRow {
  id: string;
  filename: string;
  original_path: string | null;
  optimized_path: string | null;
  webp_path: string | null;
  png_path: string | null;
  original_size: number;
  optimized_size: number | null;
  complexity: string;
}

interface OptReportRow {
  base64_detected: boolean;
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

  const reportInputs: Array<{
    filename: string;
    original_size: number;
    optimized_size: number | null;
    complexity: string;
    webp_path: string | null;
    png_path?: string | null;
    base64_detected?: boolean;
  }> = [];

  let includeWebpsFolder = false;
  let includePngsFolder = false;

  for (const asset of assets as AssetRow[]) {
    const svgPath = asset.optimized_path ?? asset.original_path;
    if (!svgPath) continue;

    const svgBuffer = await downloadFile(svgPath);
    archive.append(svgBuffer, { name: `svgs/${asset.filename}` });

    const { data: optReport } = await supabase
      .from('optimization_reports')
      .select('base64_detected')
      .eq('asset_id', asset.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const base64Detected = (optReport as OptReportRow | null)?.base64_detected ?? false;
    const webpRecommended =
      asset.complexity === 'complex' || base64Detected;

    if (webpRecommended) {
      includeWebpsFolder = true;
      includePngsFolder = true;
    }

    if (asset.webp_path) {
      includeWebpsFolder = true;
      const webpBuffer = await downloadFile(asset.webp_path);
      const webpName = asset.filename.replace(/\.svg$/i, '.webp');
      archive.append(webpBuffer, { name: `webps/${webpName}` });
    }

    if (asset.png_path) {
      includePngsFolder = true;
      const pngBuffer = await downloadFile(asset.png_path);
      const pngName = asset.filename.replace(/\.svg$/i, '.png');
      archive.append(pngBuffer, { name: `pngs/${pngName}` });
    }

    reportInputs.push({
      filename: asset.filename,
      original_size: asset.original_size,
      optimized_size: asset.optimized_size,
      complexity: asset.complexity,
      webp_path: asset.webp_path,
      png_path: asset.png_path,
      base64_detected: base64Detected,
    });
  }

  const { rows, summary } = buildReportRows(reportInputs);
  const pdfBuffer = await buildBundleReportPdf(rows, summary);
  archive.append(pdfBuffer, { name: 'report/optimization-report.pdf' });

  if (includeWebpsFolder && summary.webpIncludedCount === 0) {
    archive.append(
      'These assets are recommended for WebP conversion. Convert them in the workspace, then download the bundle again to include WebP files.\n',
      { name: 'webps/README.txt' }
    );
  }

  if (includePngsFolder && summary.pngIncludedCount === 0) {
    archive.append(
      'These assets are recommended for PNG conversion. Convert them in the workspace, then download the bundle again to include PNG files.\n',
      { name: 'pngs/README.txt' }
    );
  }

  await archive.finalize();

  const zipBuffer = await zipDone;
  const storagePath = zipPath(bundleJobId);
  await uploadFile(storagePath, zipBuffer, 'application/zip');

  await supabase
    .from('zip_bundles')
    .update({ storage_path: storagePath, status: 'complete' })
    .eq('id', bundleJobId);
}
