import { useMemo, useState } from 'react';
import UploadDropzone from '../components/UploadDropzone';
import AssetRow from '../components/AssetRow';
import AssetDrawer from '../components/AssetDrawer';
import GuestLanding from '../components/GuestLanding';
import Icon from '../components/Icon';
import { useAuth } from '../context/AuthContext.js';
import { useUpload } from '../hooks/useUpload';
import { getPreviewForAsset, useAssetPreviews } from '../hooks/useAssetPreviews';
import {
  useAssets,
  useOptimizeAssets,
  useConvertWebp,
  useDownloadBundle,
  useDownloadAsset,
  useDownloadWebp,
  useDeleteAsset,
} from '../hooks/useAssets';
import './AppPage.css';

function AppPageContent() {
  const { data: assets = [], isLoading, error } = useAssets();
  const optimize = useOptimizeAssets();
  const convertWebp = useConvertWebp();
  const downloadBundle = useDownloadBundle();
  const downloadAsset = useDownloadAsset();
  const downloadWebp = useDownloadWebp();
  const deleteAssetMutation = useDeleteAsset();
  const { uploads, uploadFiles, zonePhase, batchTotal, batchProgress, batchLoadedBytes } =
    useUpload(assets);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedAsset = useMemo(
    () => (selectedId ? assets.find((a) => a.id === selectedId) ?? null : null),
    [assets, selectedId]
  );

  const assetIds = useMemo(() => assets.map((a) => a.id), [assets]);
  const { data: previews } = useAssetPreviews(assetIds);

  const uploadedIds = assets.filter((a) => a.status === 'uploaded').map((a) => a.id);
  const completeIds = assets.filter((a) => a.status === 'complete').map((a) => a.id);

  const handleOptimizeAll = () => {
    if (uploadedIds.length) optimize.mutate(uploadedIds);
  };

  const handleDownloadBundle = () => {
    if (completeIds.length) downloadBundle.mutate(completeIds);
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

      {deleteAssetMutation.isError && (
        <div className="app-page__alert">
          Delete failed: {(deleteAssetMutation.error as Error).message}
        </div>
      )}

      <section className="app-page__assets">
        <div className="app-page__assets-header">
          <h2 className="app-page__assets-title">Uploaded assets</h2>
          <div className="app-page__assets-actions">
            <button
              type="button"
              disabled={!uploadedIds.length || optimize.isPending}
              onClick={handleOptimizeAll}
              className="app-page__btn app-page__btn--solid"
            >
              <Icon size="sm" viewBox="0 0 16 16" stroke="currentColor">
                <circle cx="8" cy="8" r="2.5" strokeWidth="1.5" />
                <path
                  d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </Icon>
              {optimize.isPending ? 'Queuing…' : 'Optimise all'}
            </button>
            <button
              type="button"
              disabled={!completeIds.length || downloadBundle.isPending}
              onClick={handleDownloadBundle}
              className="app-page__btn app-page__btn--secondary"
            >
              <Icon size="sm" viewBox="0 0 16 16" stroke="currentColor">
                <path d="M3 5.5h10v7.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5.5z" strokeWidth="1.5" />
                <path
                  d="M6 3.5h4v2H6zM8 8v3M6.5 10.5 8 12l1.5-1.5"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Icon>
              {downloadBundle.isPending ? 'Preparing ZIP…' : 'Download ZIP'}
            </button>
          </div>
        </div>

        <div className="app-page__list-wrap">
          <ul className="app-page__asset-list">
            {isLoading && (
              <li className="app-page__list-empty">Loading assets…</li>
            )}
            {!isLoading && assets.length === 0 && (
              <li className="app-page__list-empty">
                No assets yet. Upload SVGs above to get started.
              </li>
            )}
            {assets.map((asset) => (
              <AssetRow
                key={asset.id}
                asset={asset}
                thumbnail={getPreviewForAsset(previews, asset.id)?.thumbnail}
                onSelect={(asset) => setSelectedId(asset.id)}
                onDownload={(asset) => downloadAsset.mutate(asset.id)}
                onDelete={(id) => {
                  deleteAssetMutation.mutate(id, {
                    onSuccess: () => {
                      if (selectedId === id) setSelectedId(null);
                    },
                  });
                }}
                isDeleting={deleteAssetMutation.isPending}
              />
            ))}
          </ul>
        </div>
      </section>

      <AssetDrawer
        asset={selectedAsset}
        previewSet={
          selectedAsset ? getPreviewForAsset(previews, selectedAsset.id) : undefined
        }
        onClose={() => setSelectedId(null)}
        onConvertWebp={(id) => convertWebp.mutate(id)}
        onDownloadWebp={(id) => downloadWebp.mutate(id)}
        isConverting={
          convertWebp.isPending && convertWebp.variables === selectedAsset?.id
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
