import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AssetWithJob } from '@asset-optimiser/shared-types';
import {
  convertToWebp,
  deleteAsset,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset-previews'] });
    },
  });
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
