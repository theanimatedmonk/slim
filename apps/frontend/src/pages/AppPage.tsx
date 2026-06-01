import { useCallback, useEffect, useMemo, useState } from 'react';
import UploadDropzone from '../components/UploadDropzone';
import AssetRow from '../components/AssetRow';
import AssetDrawer from '../components/AssetDrawer';
import AssetTableHeader from '../components/AssetTableHeader';
import BulkActionBar from '../components/BulkActionBar';
import GuestLanding from '../components/GuestLanding';
import { useAuth } from '../context/AuthContext.js';
import { useUpload } from '../hooks/useUpload';
import { getPreviewForAsset, useAssetPreviews } from '../hooks/useAssetPreviews';
import {
  useAssets,
  useAssetDetail,
  useAutoOptimizePending,
  useConvertWebp,
  useDownloadBundle,
  useDownloadAsset,
  useDownloadWebp,
  useDeleteAsset,
  useDeleteAssets,
  useRetryAsset,
} from '../hooks/useAssets';
import './AppPage.css';

function AppPageContent() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());

  const { data: assets = [], isLoading, error } = useAssets();
  useAutoOptimizePending(assets);
  const { uploads, uploadFiles, zonePhase, batchTotal, batchProgress, batchLoadedBytes } =
    useUpload(assets);

  const convertWebp = useConvertWebp();
  const downloadBundle = useDownloadBundle();
  const downloadAsset = useDownloadAsset();
  const downloadWebp = useDownloadWebp();
  const deleteAssetMutation = useDeleteAsset();
  const deleteAssetsMutation = useDeleteAssets();
  const retryAssetMutation = useRetryAsset();

  const completeIdsList = useMemo(
    () => assets.filter((a) => a.status === 'complete').map((a) => a.id),
    [assets]
  );

  const completeAssetIds = useMemo(() => new Set(completeIdsList), [completeIdsList]);

  const allCompleteSelected =
    completeIdsList.length > 0 && completeIdsList.every((id) => checkedIds.has(id));
  const someCompleteSelected =
    completeIdsList.some((id) => checkedIds.has(id)) && !allCompleteSelected;

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      setCheckedIds(checked ? new Set(completeIdsList) : new Set());
    },
    [completeIdsList]
  );

  const selectedAsset = useMemo(
    () => (selectedId ? assets.find((a) => a.id === selectedId) ?? null : null),
    [assets, selectedId]
  );

  const { data: assetDetail } = useAssetDetail(selectedId, selectedAsset?.status);

  const drawerAsset = useMemo(() => {
    if (!selectedAsset) return null;
    if (!assetDetail) return selectedAsset;
    return {
      ...assetDetail,
      status: selectedAsset.status,
      webp_path: selectedAsset.webp_path ?? assetDetail.webp_path,
      optimized_size: selectedAsset.optimized_size ?? assetDetail.optimized_size,
      complexity:
        selectedAsset.complexity !== 'unknown' ? selectedAsset.complexity : assetDetail.complexity,
      base64_detected: selectedAsset.base64_detected ?? assetDetail.report?.base64_detected ?? null,
    };
  }, [selectedAsset, assetDetail]);

  const assetIds = useMemo(() => assets.map((a) => a.id), [assets]);
  const { data: previews } = useAssetPreviews(assetIds);

  const selectedCompleteIds = useMemo(
    () => [...checkedIds].filter((id) => completeAssetIds.has(id)),
    [checkedIds, completeAssetIds]
  );

  useEffect(() => {
    setCheckedIds((prev) => {
      const next = new Set([...prev].filter((id) => completeAssetIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [completeAssetIds]);

  const toggleChecked = useCallback((assetId: string, checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(assetId);
      else next.delete(assetId);
      return next;
    });
  }, []);

  const handleBulkDownload = () => {
    if (selectedCompleteIds.length) {
      downloadBundle.mutate(selectedCompleteIds);
    }
  };

  const handleBulkDelete = () => {
    const count = selectedCompleteIds.length;
    if (!count) return;

    const message =
      count === 1
        ? 'Delete 1 selected file? This cannot be undone.'
        : `Delete ${count} selected files? This cannot be undone.`;

    if (!window.confirm(message)) return;

    deleteAssetsMutation.mutate(selectedCompleteIds, {
      onSuccess: () => {
        setCheckedIds(new Set());
        if (selectedId && selectedCompleteIds.includes(selectedId)) {
          setSelectedId(null);
        }
      },
    });
  };

  return (
    <div className="app-page">
      <div className="app-page__upload">
        <UploadDropzone
          onFiles={uploadFiles}
          uploads={uploads}
          zonePhase={zonePhase}
          batchTotal={batchTotal}
          batchProgress={batchProgress}
          batchLoadedBytes={batchLoadedBytes}
        />
      </div>

      {error && <div className="app-page__alert">{(error as Error).message}</div>}

      {(deleteAssetMutation.isError || deleteAssetsMutation.isError) && (
        <div className="app-page__alert">
          Delete failed:{' '}
          {((deleteAssetsMutation.error ?? deleteAssetMutation.error) as Error).message}
        </div>
      )}

      {retryAssetMutation.isError && (
        <div className="app-page__alert">
          Retry failed: {(retryAssetMutation.error as Error).message}
        </div>
      )}

      <section className="app-page__assets">
        <div className="app-page__list-wrap">
          <ul className="app-page__asset-list">
            {!isLoading && assets.length > 0 && (
              <AssetTableHeader
                checked={allCompleteSelected}
                indeterminate={someCompleteSelected}
                disabled={completeIdsList.length === 0}
                onSelectAll={handleSelectAll}
              />
            )}
            {isLoading && (
              <li className="app-page__list-empty">Loading assets…</li>
            )}
            {!isLoading && assets.length === 0 && (
              <li className="app-page__list-empty">
                No assets yet. Upload SVGs above to get started.
              </li>
            )}
            {assets.map((asset) => {
              const isComplete = asset.status === 'complete';
              const isChecked = checkedIds.has(asset.id);

              return (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  thumbnail={getPreviewForAsset(previews, asset.id)?.thumbnail}
                  selectable={isComplete}
                  checked={isChecked}
                  onCheckedChange={(checked) => toggleChecked(asset.id, checked)}
                  onSelect={() => setSelectedId(asset.id)}
                  onDownload={(asset) => downloadAsset.mutate(asset.id)}
                  onDelete={(id) => {
                    deleteAssetMutation.mutate(id, {
                      onSuccess: () => {
                        setCheckedIds((prev) => {
                          const next = new Set(prev);
                          next.delete(id);
                          return next;
                        });
                        if (selectedId === id) setSelectedId(null);
                      },
                    });
                  }}
                  onRetry={(id) => retryAssetMutation.mutate(id)}
                  isDeleting={deleteAssetMutation.isPending || deleteAssetsMutation.isPending}
                  isRetrying={
                    retryAssetMutation.isPending && retryAssetMutation.variables === asset.id
                  }
                />
              );
            })}
          </ul>
        </div>
      </section>

      <BulkActionBar
        count={selectedCompleteIds.length}
        onDownload={handleBulkDownload}
        onDelete={handleBulkDelete}
        onClear={() => setCheckedIds(new Set())}
        isDownloading={downloadBundle.isPending}
        isDeleting={deleteAssetsMutation.isPending}
      />

      <AssetDrawer
        asset={drawerAsset}
        previewSet={
          drawerAsset ? getPreviewForAsset(previews, drawerAsset.id) : undefined
        }
        onClose={() => setSelectedId(null)}
        onConvertWebp={(id) => convertWebp.mutate(id)}
        onDownloadWebp={(id) => downloadWebp.mutate(id)}
        isConverting={
          convertWebp.isPending && convertWebp.variables === selectedId
        }
      />
    </div>
  );
}

export default function AppPage() {
  const { user, loading, signInWithGoogle } = useAuth();

  if (loading) {
    return (
      <div className="app-page">
        <p className="app-page__loading">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <GuestLanding onSignIn={() => signInWithGoogle()} />;
  }

  return <AppPageContent />;
}
