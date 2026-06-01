import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AssetWithJob } from '@asset-optimiser/shared-types';
import {
  convertToWebp,
  deleteAsset,
  getAssetDownloadUrl,
  getAssetWebpDownloadUrl,
  getBundleDownloadUrl,
  listAssets,
  requestBundle,
  startOptimization,
} from '../services/api';

export function useAssets() {
  return useQuery({
    queryKey: ['assets'],
    queryFn: listAssets,
  });
}

export function useOptimizeAssets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assetIds: string[]) => startOptimization(assetIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-previews'] });
    },
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assetId: string) => deleteAsset(assetId),
    onMutate: async (assetId) => {
      await queryClient.cancelQueries({ queryKey: ['assets'] });
      const previous = queryClient.getQueryData<AssetWithJob[]>(['assets']);
      queryClient.setQueryData<AssetWithJob[]>(['assets'], (old) =>
        (old ?? []).filter((a) => a.id !== assetId)
      );
      return { previous };
    },
    onError: (_err, _assetId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['assets'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-previews'] });
    },
  });
}

export function useConvertWebp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assetId: string) => convertToWebp(assetId),
    onMutate: async (assetId) => {
      await queryClient.cancelQueries({ queryKey: ['assets'] });
      const previous = queryClient.getQueryData<AssetWithJob[]>(['assets']);
      queryClient.setQueryData<AssetWithJob[]>(['assets'], (old) =>
        (old ?? []).map((a) =>
          a.id === assetId ? { ...a, status: 'converting' as const } : a
        )
      );
      return { previous };
    },
    onError: (_err, _assetId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['assets'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-previews'] });
    },
  });
}

export function useDownloadAsset() {
  return useMutation({
    mutationFn: async (assetId: string) => {
      const { downloadUrl, filename } = await getAssetDownloadUrl(assetId);
      triggerFileDownload(downloadUrl, filename);
    },
  });
}

export function useDownloadWebp() {
  return useMutation({
    mutationFn: async (assetId: string) => {
      const { downloadUrl, filename } = await getAssetWebpDownloadUrl(assetId);
      triggerFileDownload(downloadUrl, filename);
    },
  });
}

function triggerFileDownload(downloadUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function useDownloadBundle() {
  return useMutation({
    mutationFn: async (assetIds: string[]) => {
      const { jobId } = await requestBundle(assetIds);

      let attempts = 0;
      while (attempts < 30) {
        try {
          const { downloadUrl } = await getBundleDownloadUrl(jobId);
          window.open(downloadUrl, '_blank');
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 2000));
          attempts += 1;
        }
      }

      throw new Error('Bundle generation timed out');
    },
  });
}

export function isAssetProcessing(asset: AssetWithJob): boolean {
  return ['queued', 'optimizing', 'converting'].includes(asset.status);
}

export function shouldRecommendWebp(asset: AssetWithJob): boolean {
  return (
    asset.status === 'complete' &&
    (asset.complexity === 'complex' || asset.report?.base64_detected === true)
  );
}
