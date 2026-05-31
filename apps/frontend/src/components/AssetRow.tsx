import type { AssetPreview, AssetWithJob } from '@asset-optimiser/shared-types';
import AssetPreviewImage from './AssetPreviewImage';
import { formatBytes, calculateReductionPercent } from '../utils/format';
import { complexityColor, statusLabel } from '../utils/format';
import { shouldRecommendWebp } from '../hooks/useAssets';

interface Props {
  asset: AssetWithJob;
  thumbnail?: AssetPreview | null;
  onSelect: (asset: AssetWithJob) => void;
  onConvertWebp: (assetId: string) => void;
  onDownload: (asset: AssetWithJob) => void;
  onDelete: (assetId: string) => void;
  isConverting?: boolean;
  isDeleting?: boolean;
}

export default function AssetRow({
  asset,
  thumbnail,
  onSelect,
  onConvertWebp,
  onDownload,
  onDelete,
  isConverting,
  isDeleting,
}: Props) {
  const reduction =
    asset.optimized_size != null
      ? calculateReductionPercent(asset.original_size, asset.optimized_size)
      : null;

  const recommendWebp = shouldRecommendWebp(asset);

  return (
    <tr
      className="border-b border-border hover:bg-white/5 cursor-pointer transition-colors"
      onClick={() => onSelect(asset)}
    >
      <td className="py-3 px-4">
        <AssetPreviewImage
          preview={thumbnail}
          alt={asset.filename}
          size="sm"
        />
      </td>
      <td className="py-3 px-4 font-medium truncate max-w-[180px]">
        {asset.filename}
      </td>
      <td className="py-3 px-4 text-gray-400 text-sm">
        {formatBytes(asset.original_size)}
      </td>
      <td className="py-3 px-4">
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            asset.status === 'optimizing'
              ? 'text-brand-400 bg-brand-400/10 animate-pulse'
              : 'text-gray-300 bg-gray-700/50'
          }`}
        >
          {statusLabel(asset.status)}
        </span>
      </td>
      <td className="py-3 px-4 text-sm text-gray-400">
        {asset.job?.passes ?? '—'}
      </td>
      <td className="py-3 px-4 text-sm">
        {reduction != null ? (
          <span className="text-emerald-400">↓ {reduction}%</span>
        ) : (
          '—'
        )}
      </td>
      <td className="py-3 px-4">
        <span
          className={`text-xs px-2 py-1 rounded-full capitalize ${complexityColor(asset.complexity)}`}
        >
          {asset.complexity}
        </span>
      </td>
      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap gap-2">
          {asset.status === 'complete' && (
            <>
              <button
                type="button"
                onClick={() => onDownload(asset)}
                className="text-xs px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-500 text-white"
              >
                Download
              </button>
              {recommendWebp && !asset.webp_path && (
                <button
                  type="button"
                  disabled={isConverting}
                  onClick={() => onConvertWebp(asset.id)}
                  className="text-xs px-3 py-1.5 rounded-md border border-amber-500/50 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50"
                >
                  Convert to WebP
                </button>
              )}
              {asset.webp_path && (
                <span className="text-xs text-emerald-400 self-center">WebP ready</span>
              )}
            </>
          )}
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => {
              if (window.confirm(`Delete "${asset.filename}"? This cannot be undone.`)) {
                onDelete(asset.id);
              }
            }}
            className="text-xs px-3 py-1.5 rounded-md border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
