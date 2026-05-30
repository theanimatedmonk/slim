import type {
  Asset,
  AssetWithJob,
  ConvertWebpResponse,
  JobStatusResponse,
  OptimizeResponse,
  RegisterAssetRequest,
  UploadUrlResponse,
} from '@asset-optimiser/shared-types';

// Dev: use Vite proxy (same origin). Prod: set VITE_API_URL to Render API URL.
const API_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? '' : 'http://localhost:3001');

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? res.statusText);
  }

  return res.json() as Promise<T>;
}

export async function getUploadUrl(filename: string): Promise<UploadUrlResponse> {
  return request<UploadUrlResponse>('/upload-url', {
    method: 'POST',
    body: JSON.stringify({ filename, contentType: 'image/svg+xml' }),
  });
}

export async function registerAsset(
  data: RegisterAssetRequest
): Promise<Asset> {
  return request<Asset>('/assets/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function uploadToStorage(
  signedUrl: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('Content-Type', 'image/svg+xml');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status}`));
    };

    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(file);
  });
}

export async function listAssets(): Promise<AssetWithJob[]> {
  return request<AssetWithJob[]>('/assets');
}

export async function startOptimization(
  assetIds: string[]
): Promise<OptimizeResponse> {
  return request<OptimizeResponse>('/optimize', {
    method: 'POST',
    body: JSON.stringify({ assetIds }),
  });
}

export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  return request<JobStatusResponse>(`/job/${jobId}`);
}

export async function convertToWebp(
  assetId: string
): Promise<ConvertWebpResponse> {
  return request<ConvertWebpResponse>('/convert-webp', {
    method: 'POST',
    body: JSON.stringify({ assetId }),
  });
}

export async function requestBundle(assetIds: string[]): Promise<{ jobId: string }> {
  return request<{ jobId: string }>('/download', {
    method: 'POST',
    body: JSON.stringify({ assetIds }),
  });
}

export async function getBundleDownloadUrl(
  jobId: string
): Promise<{ downloadUrl: string }> {
  return request<{ downloadUrl: string }>(`/download/${jobId}`);
}
