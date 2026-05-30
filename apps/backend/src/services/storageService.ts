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
