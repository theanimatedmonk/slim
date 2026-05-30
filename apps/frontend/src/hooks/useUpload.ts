import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getUploadUrl, registerAsset, uploadToStorage } from '../services/api';

export interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

export function useUpload() {
  const queryClient = useQueryClient();
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  const uploadFiles = useCallback(async (files: File[]) => {
    const svgFiles = files.filter((f) =>
      f.name.toLowerCase().endsWith('.svg')
    );

    if (!svgFiles.length) return;

    const items: UploadItem[] = svgFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      progress: 0,
      status: 'pending',
    }));

    setUploads((prev) => [...prev, ...items]);

    for (const item of items) {
      try {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === item.id ? { ...u, status: 'uploading' } : u
          )
        );

        const { signedUrl, path, assetId } = await getUploadUrl(item.file.name);

        await uploadToStorage(signedUrl, item.file, (progress) => {
          setUploads((prev) =>
            prev.map((u) => (u.id === item.id ? { ...u, progress } : u))
          );
        });

        await registerAsset({
          assetId,
          filename: item.file.name,
          path,
          size: item.file.size,
        });

        setUploads((prev) =>
          prev.map((u) =>
            u.id === item.id ? { ...u, status: 'done', progress: 100 } : u
          )
        );
      } catch (err) {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === item.id
              ? {
                  ...u,
                  status: 'error',
                  error: err instanceof Error ? err.message : 'Upload failed',
                }
              : u
          )
        );
      }
    }

    queryClient.invalidateQueries({ queryKey: ['assets'] });
  }, [queryClient]);

  return { uploads, uploadFiles, clearUploads: () => setUploads([]) };
}
