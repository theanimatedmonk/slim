import type { AssetWithJob } from '@asset-optimiser/shared-types';
import { formatBytes, calculateReductionPercent } from '../utils/format';

interface Props {
  asset: AssetWithJob | null;
  onClose: () => void;
  onConvertWebp: (assetId: string) => void;
}

export default function AssetDrawer({ asset, onClose, onConvertWebp }: Props) {
  if (!asset) return null;

  const finalReduction =
    asset.optimized_size != null
      ? calculateReductionPercent(asset.original_size, asset.optimized_size)
      : 0;

  const recommendWebp =
    asset.complexity === 'complex' || asset.report?.base64_detected;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden
      />
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-surface-elevated border-l border-border z-50 overflow-y-auto shadow-2xl">
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold">{asset.filename}</h2>
              <p className="text-sm text-gray-400 mt-1 capitalize">
                {asset.complexity} · {asset.status}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1"
            >
              ✕
            </button>
          </div>

          <section className="mb-6">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
              Before / After
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-surface p-4 border border-border">
                <p className="text-xs text-gray-500">Original</p>
                <p className="text-lg font-semibold mt-1">
                  {formatBytes(asset.original_size)}
                </p>
              </div>
              <div className="rounded-lg bg-surface p-4 border border-border">
                <p className="text-xs text-gray-500">Optimized</p>
                <p className="text-lg font-semibold mt-1 text-emerald-400">
                  {asset.optimized_size != null
                    ? formatBytes(asset.optimized_size)
                    : '—'}
                </p>
              </div>
            </div>
            {asset.job?.stabilized && (
              <p className="text-sm text-emerald-400 mt-3">
                Optimization stabilized · Final reduction: {finalReduction}%
              </p>
            )}
          </section>

          {asset.passes && asset.passes.length > 0 && (
            <section className="mb-6">
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
                Optimization Passes
              </h3>
              <div className="space-y-3">
                {asset.passes.map((pass) => (
                  <div
                    key={pass.id}
                    className="flex items-center gap-3 text-sm border-l-2 border-brand-600 pl-3"
                  >
                    <div>
                      <p className="font-medium">Pass {pass.pass_number}</p>
                      <p className="text-gray-400">{formatBytes(pass.size_bytes)}</p>
                    </div>
                    <span className="ml-auto text-emerald-400">
                      ↓ {pass.reduction_percent}%
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {recommendWebp && (
            <section className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <h3 className="font-medium text-amber-400 mb-2">
                Complex SVG detected
              </h3>
              <p className="text-sm text-gray-300 mb-3">
                This asset still contains characteristics that may impact Android
                rendering performance. WebP conversion is recommended.
              </p>
              {asset.report?.operations && asset.report.operations.length > 0 && (
                <ul className="text-xs text-gray-400 space-y-1 mb-3 list-disc list-inside">
                  {asset.report.operations.map((op) => (
                    <li key={op}>{op}</li>
                  ))}
                </ul>
              )}
              {!asset.webp_path && (
                <button
                  type="button"
                  onClick={() => onConvertWebp(asset.id)}
                  className="w-full py-2 rounded-md bg-amber-500 hover:bg-amber-400 text-black font-medium text-sm"
                >
                  Convert to WebP
                </button>
              )}
            </section>
          )}

          {asset.report && (
            <section>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
                Complexity Report
              </h3>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-gray-500">Paths</dt>
                <dd>{asset.report.path_count}</dd>
                <dt className="text-gray-500">Gradients</dt>
                <dd>{asset.report.gradients}</dd>
                <dt className="text-gray-500">Score</dt>
                <dd>{asset.report.final_complexity_score}</dd>
                <dt className="text-gray-500">Base64 images</dt>
                <dd>{asset.report.base64_detected ? 'Yes' : 'No'}</dd>
              </dl>
            </section>
          )}
        </div>
      </aside>
    </>
  );
}
