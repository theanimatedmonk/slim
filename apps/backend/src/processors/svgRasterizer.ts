import sharp from 'sharp';
import { MAX_RASTER_DIMENSION } from '@asset-optimiser/shared-utils';

const WEBP_QUALITY = 80;
const PNG_COMPRESSION_LEVEL = 9;

export async function rasterizeSvgBuffer(
  svgBuffer: Buffer,
  format: 'webp' | 'png'
): Promise<Buffer> {
  const pipeline = sharp(svgBuffer, {
    density: 150,
    limitInputPixels: MAX_RASTER_DIMENSION * MAX_RASTER_DIMENSION,
  }).resize({
    width: MAX_RASTER_DIMENSION,
    height: MAX_RASTER_DIMENSION,
    fit: 'inside',
    withoutEnlargement: true,
  });

  if (format === 'webp') {
    return pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
  }

  return pipeline.png({ compressionLevel: PNG_COMPRESSION_LEVEL }).toBuffer();
}
