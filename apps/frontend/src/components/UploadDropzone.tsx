import { useCallback, useId, useRef, useState } from 'react';
import type { UploadItem, UploadZonePhase } from '../hooks/useUpload';
import Icon from './Icon';
import UploadIconRive from './UploadIconRive';
import UploadProgressRive from './UploadProgressRive';
import './UploadDropzone.css';

function UploadErrorIcon() {
  return (
    <Icon size="md" viewBox="0 0 20 20" fill="var(--color-error)" stroke="none" className="upload-dropzone__error-icon">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M3.45967 13.888L8.90109 4.80384C9.01567 4.61508 9.17696 4.45903 9.36938 4.35074C9.56181 4.24244 9.7789 4.18555 9.99971 4.18555C10.2205 4.18555 10.4376 4.24244 10.63 4.35074C10.8225 4.45903 10.9837 4.61508 11.0983 4.80384L16.5397 13.888C16.6519 14.0823 16.7112 14.3026 16.7117 14.5269C16.7123 14.7513 16.6542 14.9719 16.5431 15.1668C16.432 15.3616 16.2718 15.5241 16.0785 15.6379C15.8852 15.7517 15.6654 15.8129 15.4411 15.8154H4.55829C4.33388 15.8131 4.11399 15.752 3.92053 15.6383C3.72707 15.5246 3.56679 15.3621 3.45565 15.1671C3.34452 14.9722 3.28641 14.7515 3.28712 14.527C3.28782 14.3026 3.34732 14.0823 3.45967 13.888ZM9.99971 7.72037C10.2042 7.72037 10.4003 7.8016 10.5449 7.94618C10.6894 8.09076 10.7707 8.28686 10.7707 8.49133V10.8042C10.7707 11.0087 10.6894 11.2048 10.5449 11.3494C10.4003 11.4939 10.2042 11.5752 9.99971 11.5752C9.79524 11.5752 9.59914 11.4939 9.45456 11.3494C9.30998 11.2048 9.22875 11.0087 9.22875 10.8042V8.49133C9.22875 8.28686 9.30998 8.09076 9.45456 7.94618C9.59914 7.8016 9.79524 7.72037 9.99971 7.72037ZM9.22875 13.1171C9.22875 12.9126 9.30998 12.7165 9.45456 12.5719C9.59914 12.4273 9.79524 12.3461 9.99971 12.3461H10.0059C10.2103 12.3461 10.4064 12.4273 10.551 12.5719C10.6956 12.7165 10.7768 12.9126 10.7768 13.1171C10.7768 13.3215 10.6956 13.5176 10.551 13.6622C10.4064 13.8068 10.2103 13.888 10.0059 13.888H9.99971C9.79524 13.888 9.59914 13.8068 9.45456 13.6622C9.30998 13.5176 9.22875 13.3215 9.22875 13.1171Z" fill="#CB2525"/>

    </Icon>
  );
}

interface Props {
  onFiles: (files: File[]) => void;
  uploads?: UploadItem[];
  zonePhase?: UploadZonePhase;
  batchTotal?: number;
  batchProgress?: number;
  batchLoadedBytes?: number;
  rejectionMessages?: string[];
  disabled?: boolean;
}

export default function UploadDropzone({
  onFiles,
  uploads: _uploads = [],
  zonePhase = 'idle',
  batchTotal = 0,
  batchProgress = 0,
  batchLoadedBytes: _batchLoadedBytes = 0,
  rejectionMessages = [],
  disabled = false,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const batchCount = batchTotal;
  const overallProgress =
    zonePhase === 'success' ? 100 : zonePhase === 'uploading' ? batchProgress : 0;

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

        <p className="upload-dropzone__title">
          {zonePhase === 'idle' && 'Drag and drop SVG files here'}
          {zonePhase === 'success' && 'Success!'}
          {zonePhase === 'uploading' && (
            <>
              Uploading <strong>{batchCount}</strong> file(s)
            </>
          )}
        </p>

        <div className="upload-dropzone__footer">
          {zonePhase === 'idle' && (
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
                <p className="upload-dropzone__subtext">{Math.round(overallProgress)}%</p>
              ))}
          </div>
        </div>
      </div>

      {rejectionMessages.length > 0 && (
        <div className="upload-dropzone__errors">
          {rejectionMessages.map((message, index) => (
            <p key={`${message}-${index}`} className="upload-dropzone__error" role="alert">
              <UploadErrorIcon />
              <span>{message}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
