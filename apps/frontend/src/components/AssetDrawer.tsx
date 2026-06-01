import type { AssetListItem, AssetPreviewSet, AssetWithJob } from '@asset-optimiser/shared-types';
import AssetPreviewImage from './AssetPreviewImage';
import { shouldRecommendWebp } from '../hooks/useAssets';
import { formatBytes, calculateReductionPercent } from '../utils/format';
import './AssetDrawer.css';

type DrawerAsset = AssetWithJob & Pick<AssetListItem, 'base64_detected'>;

interface Props {
  asset: DrawerAsset | null;
  previewSet?: AssetPreviewSet;
  onClose: () => void;
  onConvertWebp: (assetId: string) => void;
  onDownloadWebp: (assetId: string) => void;
  isConverting?: boolean;
}

export default function AssetDrawer({
  asset,
  previewSet,
  onClose,
  onConvertWebp,
  onDownloadWebp,
  isConverting,
}: Props) {
  if (!asset) return null;

  const finalReduction =
    asset.optimized_size != null
      ? calculateReductionPercent(asset.original_size, asset.optimized_size)
      : 0;

  const isComplexAsset =
    shouldRecommendWebp(asset) ||
    asset.complexity === 'complex' ||
    asset.base64_detected === true;
  const showWebpCallout =
    isComplexAsset && !['uploaded', 'queued', 'optimizing'].includes(asset.status);
  const isWebpReady = Boolean(asset.webp_path);
  const isWebpConverting =
    !isWebpReady && (asset.status === 'converting' || isConverting);

  return (
    <>
      <div className="asset-drawer__overlay" onClick={onClose} aria-hidden />
      <aside className="asset-drawer">
        <div className="asset-drawer__inner">
          <div className="asset-drawer__header">
            <div>
              <h2 className="asset-drawer__title">{asset.filename}</h2>
              <p className="asset-drawer__meta">
                {asset.complexity} · {asset.status}
              </p>
            </div>
            <button type="button" onClick={onClose} className="asset-drawer__close">
              ✕
            </button>
          </div>

          {previewSet?.thumbnail && (
            <div className="asset-drawer__hero-preview">
              <AssetPreviewImage
                preview={previewSet.thumbnail}
                alt={asset.filename}
                size="lg"
                className="asset-preview--constrained"
              />
            </div>
          )}

          <section className="asset-drawer__section">
            <h3 className="asset-drawer__section-title">Before / After</h3>
            <div className="asset-drawer__compare-grid">
              <div className="asset-drawer__compare-card">
                <AssetPreviewImage
                  preview={previewSet?.original ?? previewSet?.thumbnail}
                  alt={`${asset.filename} original`}
                  size="md"
                />
                <div>
                  <p className="asset-drawer__compare-label">Original</p>
                  <p className="asset-drawer__compare-value">
                    {formatBytes(asset.original_size)}
                  </p>
                </div>
              </div>
              <div className="asset-drawer__compare-card">
                <AssetPreviewImage
                  preview={previewSet?.optimized ?? previewSet?.webp}
                  alt={`${asset.filename} optimized`}
                  size="md"
                />
                <div>
                  <p className="asset-drawer__compare-label">Optimized</p>
                  <p className="asset-drawer__compare-value asset-drawer__compare-value--success">
                    {asset.optimized_size != null
                      ? formatBytes(asset.optimized_size)
                      : '—'}
                  </p>
                </div>
              </div>
            </div>
            {asset.job?.stabilized && (
              <p className="asset-drawer__stabilized">
                Optimization stabilized · Final reduction: {finalReduction}%
              </p>
            )}
          </section>

          {asset.passes && asset.passes.length > 0 && (
            <section className="asset-drawer__section">
              <h3 className="asset-drawer__section-title">Optimization Passes</h3>
              <div className="asset-drawer__pass-list">
                {asset.passes.map((pass) => (
                  <div key={pass.id} className="asset-drawer__pass-item">
                    <div>
                      <p className="asset-drawer__pass-size">Pass {pass.pass_number}</p>
                      <p className="asset-drawer__pass-size">{formatBytes(pass.size_bytes)}</p>
                    </div>
                    <span className="asset-drawer__pass-reduction">
                      ↓ {pass.reduction_percent}%
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {showWebpCallout && (
            <section className="asset-drawer__section asset-drawer__webp-callout">
              <h3 className="asset-drawer__webp-title">Complex SVG detected</h3>
              <p className="asset-drawer__webp-desc">
                This asset still contains characteristics that may impact Android rendering
                performance. WebP conversion is recommended.
              </p>
              {asset.report?.operations && asset.report.operations.length > 0 && (
                <ul className="asset-drawer__webp-ops">
                  {asset.report.operations.map((op) => (
                    <li key={op}>{op}</li>
                  ))}
                </ul>
              )}
              {isWebpReady ? (
                <button
                  type="button"
                  onClick={() => onDownloadWebp(asset.id)}
                  className="asset-drawer__webp-btn"
                >
                  Download WebP
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isWebpConverting}
                  onClick={() => onConvertWebp(asset.id)}
                  className="asset-drawer__webp-btn"
                >
                  {isWebpConverting ? 'Converting…' : 'Convert to WebP'}
                </button>
              )}
            </section>
          )}

          {asset.report && (
            <section className="asset-drawer__section">
              <h3 className="asset-drawer__section-title">Complexity Report</h3>
              <dl className="asset-drawer__report-grid">
                <dt className="asset-drawer__report-term">Paths</dt>
                <dd className="asset-drawer__report-value">{asset.report.path_count}</dd>
                <dt className="asset-drawer__report-term">Gradients</dt>
                <dd className="asset-drawer__report-value">{asset.report.gradients}</dd>
                <dt className="asset-drawer__report-term">Score</dt>
                <dd className="asset-drawer__report-value">
                  {asset.report.final_complexity_score}
                </dd>
                <dt className="asset-drawer__report-term">Base64 images</dt>
                <dd className="asset-drawer__report-value">
                  {asset.report.base64_detected ? 'Yes' : 'No'}
                </dd>
              </dl>
            </section>
          )}
        </div>
      </aside>
    </>
  );
}
