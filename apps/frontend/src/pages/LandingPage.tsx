import { useNavigate } from 'react-router-dom';
import UploadDropzone from '../components/UploadDropzone';
import { useUpload } from '../hooks/useUpload';

export default function LandingPage() {
  const navigate = useNavigate();
  const { uploads, uploadFiles } = useUpload();

  const allDone =
    uploads.length > 0 && uploads.every((u) => u.status === 'done' || u.status === 'error');

  return (
    <div>
      <section className="max-w-4xl mx-auto px-4 py-20 text-center">
        <p className="text-brand-500 text-sm font-medium uppercase tracking-wider mb-4">
          Android Asset Pipeline
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-6">
          Upload your assets.
          <br />
          <span className="text-gray-400">We optimize them automatically.</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10">
          An intelligent SVG optimization engine for Android. Iterative SVGO passes
          until stabilization, complexity detection, and WebP recommendations — no
          manual settings required.
        </p>
      </section>

      <section className="max-w-2xl mx-auto px-4 pb-12">
        <UploadDropzone onFiles={uploadFiles} uploads={uploads} />
        {allDone && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => navigate('/workspace')}
              className="px-6 py-3 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-medium"
            >
              Go to Workspace →
            </button>
          </div>
        )}
      </section>

      <section className="max-w-4xl mx-auto px-4 py-16 grid md:grid-cols-3 gap-6">
        {[
          {
            title: 'Automatic optimization',
            desc: 'SVGO runs iteratively until size reduction stabilizes (<1% delta).',
          },
          {
            title: 'Complexity intelligence',
            desc: 'Detects heavy paths, gradients, filters, and embedded raster images.',
          },
          {
            title: 'WebP when needed',
            desc: 'Recommends raster conversion for assets that remain complex after optimization.',
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-border bg-surface-elevated p-6"
          >
            <h3 className="font-semibold text-white mb-2">{item.title}</h3>
            <p className="text-sm text-gray-400">{item.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
