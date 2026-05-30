import { useCallback, useState } from 'react';
import type { UploadItem } from '../hooks/useUpload';

interface Props {
  onFiles: (files: File[]) => void;
  uploads?: UploadItem[];
  compact?: boolean;
}

export default function UploadDropzone({ onFiles, uploads = [], compact }: Props) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      onFiles(files);
    },
    [onFiles]
  );

  return (
    <div className="space-y-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`
          flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-colors
          ${dragOver ? 'border-brand-500 bg-brand-500/10' : 'border-border hover:border-brand-600 hover:bg-white/5'}
          ${compact ? 'p-8' : 'p-16'}
        `}
      >
        <input
          type="file"
          accept=".svg,image/svg+xml"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            onFiles(files);
            e.target.value = '';
          }}
        />
        <div className="text-4xl mb-3 opacity-60">↑</div>
        <p className="text-lg font-medium text-white">
          Drop SVG assets here
        </p>
        <p className="text-sm text-gray-400 mt-1">
          or click to browse — multiple files supported
        </p>
      </label>

      {uploads.length > 0 && (
        <ul className="space-y-2">
          {uploads.map((u) => (
            <li
              key={u.id}
              className="flex items-center gap-3 text-sm bg-surface-elevated rounded-lg px-3 py-2 border border-border"
            >
              <span className="flex-1 truncate">{u.file.name}</span>
              {u.status === 'uploading' && (
                <div className="w-24 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 transition-all"
                    style={{ width: `${u.progress}%` }}
                  />
                </div>
              )}
              {u.status === 'done' && (
                <span className="text-emerald-400">Uploaded</span>
              )}
              {u.status === 'error' && (
                <span className="text-rose-400">{u.error}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
