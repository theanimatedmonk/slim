import { useState } from 'react';
import type { AssetWithJob } from '@asset-optimiser/shared-types';
import UploadDropzone from '../components/UploadDropzone';
import AssetRow from '../components/AssetRow';
import AssetDrawer from '../components/AssetDrawer';
import { useUpload } from '../hooks/useUpload';
import {
  useAssets,
  useOptimizeAssets,
  useConvertWebp,
  useDownloadBundle,
  useDeleteAsset,
} from '../hooks/useAssets';

export default function WorkspacePage() {
  const { data: assets = [], isLoading, error } = useAssets();
  const optimize = useOptimizeAssets();
  const convertWebp = useConvertWebp();
  const downloadBundle = useDownloadBundle();
  const deleteAssetMutation = useDeleteAsset();
  const { uploads, uploadFiles } = useUpload();
  const [selected, setSelected] = useState<AssetWithJob | null>(null);

  const uploadedIds = assets
    .filter((a) => a.status === 'uploaded')
    .map((a) => a.id);

  const completeIds = assets
    .filter((a) => a.status === 'complete')
    .map((a) => a.id);

  const handleOptimizeAll = () => {
    if (uploadedIds.length) {
      optimize.mutate(uploadedIds);
    }
  };

  const handleDownloadBundle = () => {
    if (completeIds.length) {
      downloadBundle.mutate(completeIds);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">Workspace</h1>
          <p className="text-gray-400 text-sm mt-1">
            Track optimization progress and download results
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!uploadedIds.length || optimize.isPending}
            onClick={handleOptimizeAll}
            className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-sm font-medium"
          >
            {optimize.isPending ? 'Queuing…' : 'Optimize All'}
          </button>
          <button
            type="button"
            disabled={!completeIds.length || downloadBundle.isPending}
            onClick={handleDownloadBundle}
            className="px-4 py-2 rounded-lg border border-border hover:bg-white/5 disabled:opacity-40 text-sm"
          >
            {downloadBundle.isPending ? 'Preparing ZIP…' : 'Download Bundle'}
          </button>
        </div>
      </div>

      <div className="mb-8">
        <UploadDropzone onFiles={uploadFiles} uploads={uploads} compact />
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300 text-sm mb-6">
          {(error as Error).message}
        </div>
      )}

      {deleteAssetMutation.isError && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300 text-sm mb-6">
          Delete failed: {(deleteAssetMutation.error as Error).message}
        </div>
      )}

      <div className="rounded-xl border border-border overflow-hidden bg-surface-elevated">
        <table className="w-full text-left">
          <thead>
            <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-border">
              <th className="py-3 px-4">Preview</th>
              <th className="py-3 px-4">File</th>
              <th className="py-3 px-4">Size</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Pass</th>
              <th className="py-3 px-4">Reduction</th>
              <th className="py-3 px-4">Complexity</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-gray-500">
                  Loading assets…
                </td>
              </tr>
            )}
            {!isLoading && assets.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-gray-500">
                  No assets yet. Upload SVGs to get started.
                </td>
              </tr>
            )}
            {assets.map((asset) => (
              <AssetRow
                key={asset.id}
                asset={asset}
                onSelect={setSelected}
                onConvertWebp={(id) => convertWebp.mutate(id)}
                onDownload={() => {
                  if (completeIds.length) downloadBundle.mutate([asset.id]);
                }}
                onDelete={(id) => {
                  deleteAssetMutation.mutate(id, {
                    onSuccess: () => {
                      if (selected?.id === id) setSelected(null);
                    },
                  });
                }}
                isConverting={convertWebp.isPending}
                isDeleting={deleteAssetMutation.isPending}
              />
            ))}
          </tbody>
        </table>
      </div>

      <AssetDrawer
        asset={selected}
        onClose={() => setSelected(null)}
        onConvertWebp={(id) => convertWebp.mutate(id)}
      />
    </div>
  );
}
