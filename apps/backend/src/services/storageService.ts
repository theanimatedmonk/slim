import { buildStoragePath } from '@asset-optimiser/shared-utils';
import { supabase } from '../db/supabase.js';
import { config } from '../config.js';

export async function createSignedUploadUrl(
  assetId: string,
  filename: string
): Promise<{ signedUrl: string; path: string }> {
  const path = buildStoragePath('originals', assetId, filename);

  const { data, error } = await supabase.storage
    .from(config.storageBucket)
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create signed upload URL');
  }

  return { signedUrl: data.signedUrl, path };
}

export async function createSignedDownloadUrl(
  path: string,
  expiresIn = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(config.storageBucket)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'Failed to create signed download URL');
  }

  return data.signedUrl;
}

export async function downloadFile(path: string): Promise<Buffer> {
  const { data, error } = await supabase.storage
    .from(config.storageBucket)
    .download(path);

  if (error || !data) {
    throw new Error(error?.message ?? `Failed to download: ${path}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function uploadFile(
  path: string,
  content: Buffer,
  contentType: string
): Promise<void> {
  const { error } = await supabase.storage
    .from(config.storageBucket)
    .upload(path, content, { upsert: true, contentType });

  if (error) {
    throw new Error(error.message);
  }
}

export function optimizedPath(assetId: string, filename: string): string {
  return buildStoragePath('optimized', assetId, filename);
}

export function webpPath(assetId: string, filename: string): string {
  const base = filename.replace(/\.svg$/i, '.webp');
  return buildStoragePath('webp', assetId, base);
}

export function zipPath(bundleId: string): string {
  return `zips/${bundleId}/optimized-assets.zip`;
}
