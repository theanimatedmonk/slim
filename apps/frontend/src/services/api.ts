import type {
  Asset,
  AssetListItem,
  AssetPreviewsResponse,
  AssetWithJob,
  ConvertPngResponse,
  ConvertWebpResponse,
  JobStatusResponse,
  OptimizeResponse,
  RegisterAssetRequest,
  RetryAssetResponse,
  UploadUrlResponse,
} from '@asset-optimiser/shared-types';

// Dev: always use Vite proxy (same origin, no CORS). Prod: VITE_API_URL on Vercel.
const API_URL = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_URL ?? 'http://localhost:3001');

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? res.statusText);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

export async function deleteAsset(assetId: string): Promise<void> {
  await request<void>(`/assets/${assetId}`, { method: 'DELETE' });
}

export async function retryAsset(assetId: string): Promise<RetryAssetResponse> {
  return request<RetryAssetResponse>(`/assets/${assetId}/retry`, { method: 'POST' });
}

export async function getUploadUrl(
  filename: string,
  size?: number
): Promise<UploadUrlResponse> {
  return request<UploadUrlResponse>('/upload-url', {
    method: 'POST',
    body: JSON.stringify({ filename, contentType: 'image/svg+xml', size }),
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

export async function listAssets(): Promise<AssetListItem[]> {
  return request<AssetListItem[]>('/assets');
}

export async function getAssetDetail(assetId: string): Promise<AssetWithJob> {
  return request<AssetWithJob>(`/assets/${assetId}`);
}

export async function fetchAssetPreviews(
  assetIds: string[]
): Promise<AssetPreviewsResponse> {
  return request<AssetPreviewsResponse>('/assets/previews', {
    method: 'POST',
    body: JSON.stringify({ assetIds }),
  });
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

export async function convertToPng(assetId: string): Promise<ConvertPngResponse> {
  return request<ConvertPngResponse>('/convert-png', {
    method: 'POST',
    body: JSON.stringify({ assetId }),
  });
}

export async function getAssetDownloadUrl(
  assetId: string
): Promise<{ downloadUrl: string; filename: string }> {
  return request<{ downloadUrl: string; filename: string }>(`/assets/${assetId}/download`);
}

export async function getAssetWebpDownloadUrl(
  assetId: string
): Promise<{ downloadUrl: string; filename: string }> {
  return request<{ downloadUrl: string; filename: string }>(`/assets/${assetId}/download-webp`);
}

export async function getAssetPngDownloadUrl(
  assetId: string
): Promise<{ downloadUrl: string; filename: string }> {
  return request<{ downloadUrl: string; filename: string }>(`/assets/${assetId}/download-png`);
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
