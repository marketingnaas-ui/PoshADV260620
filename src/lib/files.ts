import { AdvanceAttachment, StoredFile } from '../types';

export function isStoredFile(file: AdvanceAttachment | null | undefined): file is StoredFile {
  return Boolean(file && typeof file === 'object' && 'id' in file && 'url' in file);
}

export function fileLabel(file: AdvanceAttachment | StoredFile | string | null | undefined) {
  if (!file) return 'attachment';
  if (typeof file === 'string') return file;
  return file.originalName || file.fileName || file.id;
}

export function fileUrl(file: AdvanceAttachment | StoredFile | string | null | undefined) {
  if (!isStoredFile(file)) return '';
  return file.url || `/api/files/${file.id}/download`;
}

export async function uploadFileToServer(
  file: File,
  options: { relatedId?: string; relatedType?: string; source?: string } = {}
): Promise<StoredFile> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Cannot read file'));
    reader.readAsDataURL(file);
  });

  const response = await fetch('/api/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      dataUrl,
      ...options,
    }),
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || 'Upload failed');
  }

  return response.json();
}
