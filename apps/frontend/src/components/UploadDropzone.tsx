import { useCallback, useId, useRef, useState } from 'react';
import { formatBytes } from '../utils/format';
import type { UploadItem, UploadZonePhase } from '../hooks/useUpload';
import UploadIconRive from './UploadIconRive';
import UploadProgressRive from './UploadProgressRive';
import './UploadDropzone.css';

interface Props {
  onFiles: (files: File[]) => void;
  uploads?: UploadItem[];
  zonePhase?: UploadZonePhase;
  batchTotal?: number;
  batchProgress?: number;
  batchLoadedBytes?: number;
  disabled?: boolean;
}

function aggregateLoadedBytes(items: UploadItem[], batchLoadedBytes: number): number {
  const inFlight = items.filter((u) => u.status === 'pending' || u.status === 'uploading');
  if (inFlight.length > 0) {
    return inFlight.reduce((sum, u) => sum + u.file.size * (u.progress / 100), 0);
  }
  return batchLoadedBytes;
}

export default function UploadDropzone({
  onFiles,
  uploads = [],
  zonePhase = 'idle',
  batchTotal = 0,
  batchProgress = 0,
  batchLoadedBytes = 0,
  disabled = false,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const batchCount = batchTotal;
  const overallProgress =
    zonePhase === 'success' ? 100 : zonePhase === 'uploading' ? batchProgress : 0;
  const loadedLabel = formatBytes(Math.max(aggregateLoadedBytes(uploads, batchLoadedBytes), 0));

  const isBusy = zonePhase === 'uploading' || zonePhase === 'success';
  const zoneDisabled = disabled || isBusy;

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (zoneDisabled) return;
      onFiles(Array.from(e.dataTransfer.files));
    },
    [onFiles, zoneDisabled]
  );

  const openFilePicker = () => {
    if (!zoneDisabled) inputRef.current?.click();
  };

  return (
    <div className="upload-dropzone">
      <div
        role="button"
        tabIndex={zoneDisabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') openFilePicker();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!zoneDisabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => {
          if (!zoneDisabled && zonePhase === 'idle') openFilePicker();
        }}
        className={`upload-dropzone__zone${dragOver ? ' upload-dropzone__zone--drag-over' : ''}${isBusy ? ' upload-dropzone__zone--busy' : ''}${zonePhase === 'success' ? ' upload-dropzone__zone--success' : ''}`}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept=".svg,image/svg+xml"
          multiple
          className="upload-dropzone__input"
          disabled={zoneDisabled}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            onFiles(files);
            e.target.value = '';
          }}
        />

        <div className="upload-dropzone__icon-wrap">
          <UploadIconRive zonePhase={zonePhase} />
        </div>

        {zonePhase === 'idle' && (
          <>
            <p className="upload-dropzone__title">Drag and drop SVG files here</p>
            <button
              type="button"
              className="upload-dropzone__browse"
              onClick={(e) => {
                e.stopPropagation();
                openFilePicker();
              }}
            >
              Or choose a file
            </button>
          </>
        )}

        {isBusy && (
          <p className="upload-dropzone__title">
            {zonePhase === 'success' ? (
              'Success!'
            ) : (
              <>
                Uploading <strong>{batchCount}</strong> file(s)
              </>
            )}
          </p>
        )}

        <div
          className={`upload-dropzone__batch-progress${isBusy ? ' upload-dropzone__batch-progress--visible' : ''}`}
        >
          <UploadProgressRive progress={overallProgress} active={isBusy} />
          {isBusy &&
            (zonePhase === 'success' ? (
              <p className="upload-dropzone__subtext">
                {batchCount} file{batchCount === 1 ? '' : 's'} uploaded
              </p>
            ) : overallProgress >= 100 ? (
              <p className="upload-dropzone__subtext">Processing…</p>
            ) : (
              <div className="upload-dropzone__batch-meta">
                <span>{loadedLabel}</span>
                <span>{Math.round(overallProgress)}%</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
