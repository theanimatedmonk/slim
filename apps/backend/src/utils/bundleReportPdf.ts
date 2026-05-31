import PDFDocument from 'pdfkit';
import {
  calculateReductionPercent,
  formatBytes,
} from '@asset-optimiser/shared-utils';

export interface BundleReportRow {
  filename: string;
  originalSize: number;
  optimizedSize: number | null;
  reductionPercent: number | null;
  complexity: string;
  webpRecommended: boolean;
  webpIncluded: boolean;
}

export interface BundleReportSummary {
  assetCount: number;
  totalOriginalBytes: number;
  totalOptimizedBytes: number;
  totalReductionPercent: number;
  webpRecommendedCount: number;
  webpIncludedCount: number;
}

export function buildBundleReportPdf(
  rows: BundleReportRow[],
  summary: BundleReportSummary
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.fontSize(20).font('Helvetica-Bold').text('Asset Optimization Report', {
      align: 'center',
    });
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#444444')
      .text(`Generated ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1.5);
    doc.fillColor('#000000');

    doc.fontSize(12).font('Helvetica-Bold').text('Summary');
    doc.moveDown(0.4);
    doc.fontSize(10).font('Helvetica');
    const summaryLines = [
      `Assets in bundle: ${summary.assetCount}`,
      `Total original size: ${formatBytes(summary.totalOriginalBytes)}`,
      `Total optimized size: ${formatBytes(summary.totalOptimizedBytes)}`,
      `Total size reduction: ${summary.totalReductionPercent}%`,
      `WebP recommended: ${summary.webpRecommendedCount}`,
      `WebP files included: ${summary.webpIncludedCount}`,
    ];
    for (const line of summaryLines) {
      doc.text(line);
    }

    doc.moveDown(1.2);
    doc.fontSize(12).font('Helvetica-Bold').text('Per-asset comparison');
    doc.moveDown(0.6);

    const cols = {
      file: doc.page.margins.left,
      original: doc.page.margins.left + pageWidth * 0.38,
      optimized: doc.page.margins.left + pageWidth * 0.54,
      saved: doc.page.margins.left + pageWidth * 0.7,
      webp: doc.page.margins.left + pageWidth * 0.82,
    };

    const headerY = doc.y;
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('File', cols.file, headerY, { width: pageWidth * 0.36 });
    doc.text('Original', cols.original, headerY, { width: pageWidth * 0.14 });
    doc.text('Optimized', cols.optimized, headerY, { width: pageWidth * 0.14 });
    doc.text('Saved', cols.saved, headerY, { width: pageWidth * 0.1 });
    doc.text('WebP', cols.webp, headerY, { width: pageWidth * 0.16 });

    doc
      .moveTo(doc.page.margins.left, headerY + 14)
      .lineTo(doc.page.width - doc.page.margins.right, headerY + 14)
      .strokeColor('#cccccc')
      .stroke();
    doc.moveDown(0.8);
    doc.strokeColor('#000000');

    doc.font('Helvetica').fontSize(8);

    for (const row of rows) {
      if (doc.y > doc.page.height - 80) {
        doc.addPage();
        doc.y = doc.page.margins.top;
      }

      const rowY = doc.y;
      const optimizedLabel =
        row.optimizedSize != null ? formatBytes(row.optimizedSize) : '—';
      const savedLabel =
        row.reductionPercent != null ? `${row.reductionPercent}%` : '—';
      const webpLabel = row.webpIncluded
        ? 'Included'
        : row.webpRecommended
          ? 'Recommended'
          : '—';

      doc.text(row.filename, cols.file, rowY, {
        width: pageWidth * 0.36,
        ellipsis: true,
      });
      doc.text(formatBytes(row.originalSize), cols.original, rowY, {
        width: pageWidth * 0.14,
      });
      doc.text(optimizedLabel, cols.optimized, rowY, { width: pageWidth * 0.14 });
      doc.text(savedLabel, cols.saved, rowY, { width: pageWidth * 0.1 });
      doc.text(webpLabel, cols.webp, rowY, { width: pageWidth * 0.16 });

      doc.moveDown(0.9);
    }

    doc.end();
  });
}

export function buildReportRows(
  assets: Array<{
    filename: string;
    original_size: number;
    optimized_size: number | null;
    complexity: string;
    webp_path: string | null;
    base64_detected?: boolean;
  }>
): { rows: BundleReportRow[]; summary: BundleReportSummary } {
  const rows: BundleReportRow[] = assets.map((asset) => {
    const webpRecommended =
      asset.complexity === 'complex' || asset.base64_detected === true;
    const optimizedSize = asset.optimized_size;
    const reductionPercent =
      optimizedSize != null
        ? calculateReductionPercent(asset.original_size, optimizedSize)
        : null;

    return {
      filename: asset.filename,
      originalSize: asset.original_size,
      optimizedSize,
      reductionPercent,
      complexity: asset.complexity,
      webpRecommended,
      webpIncluded: Boolean(asset.webp_path),
    };
  });

  const totalOriginalBytes = rows.reduce((sum, r) => sum + r.originalSize, 0);
  const totalOptimizedBytes = rows.reduce(
    (sum, r) => sum + (r.optimizedSize ?? r.originalSize),
    0
  );

  return {
    rows,
    summary: {
      assetCount: rows.length,
      totalOriginalBytes,
      totalOptimizedBytes,
      totalReductionPercent: calculateReductionPercent(
        totalOriginalBytes,
        totalOptimizedBytes
      ),
      webpRecommendedCount: rows.filter((r) => r.webpRecommended).length,
      webpIncludedCount: rows.filter((r) => r.webpIncluded).length,
    },
  };
}
