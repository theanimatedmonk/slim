import { config } from '../config.js';
import { supabase } from '../db/supabase.js';
import { deleteFiles } from './storageService.js';

export async function cleanupExpiredAssets(): Promise<{
  deleted: number;
}> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - config.assetRetentionDays);

  const { data: expired, error } = await supabase
    .from('assets')
    .select('id, original_path, optimized_path, webp_path')
    .lt('created_at', cutoff.toISOString());

  if (error) {
    throw new Error(error.message);
  }

  if (!expired?.length) {
    return { deleted: 0 };
  }

  const paths: string[] = [];
  for (const row of expired) {
    if (row.original_path) paths.push(row.original_path);
    if (row.optimized_path) paths.push(row.optimized_path);
    if (row.webp_path) paths.push(row.webp_path);
  }

  await deleteFiles(paths);

  const ids = expired.map((r) => r.id);
  const { error: deleteError } = await supabase.from('assets').delete().in('id', ids);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  return { deleted: ids.length };
}
