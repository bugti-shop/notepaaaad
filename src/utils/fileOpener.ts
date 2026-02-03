// File opener utility for opening files with native system "Open with" dialog
// Uses Capacitor FileOpener plugin for native apps
// Falls back to download for web browsers

import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

// Dynamic import to avoid errors on web
let FileOpener: any = null;

// Initialize FileOpener plugin
const initFileOpener = async () => {
  if (!FileOpener && Capacitor.isNativePlatform()) {
    try {
      const module = await import('@capacitor-community/file-opener');
      FileOpener = module.FileOpener;
    } catch (e) {
      console.warn('FileOpener plugin not available:', e);
    }
  }
  return FileOpener;
};

// MIME type detection based on file extension
export const getMimeType = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  const mimeTypes: Record<string, string> = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'ico': 'image/x-icon',
    
    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'aac': 'audio/aac',
    'm4a': 'audio/mp4',
    'flac': 'audio/flac',
    'wma': 'audio/x-ms-wma',
    
    // Video
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'mkv': 'video/x-matroska',
    'wmv': 'video/x-ms-wmv',
    '3gp': 'video/3gpp',
    'flv': 'video/x-flv',
    
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'odt': 'application/vnd.oasis.opendocument.text',
    'ods': 'application/vnd.oasis.opendocument.spreadsheet',
    'odp': 'application/vnd.oasis.opendocument.presentation',
    'rtf': 'application/rtf',
    
    // Text
    'txt': 'text/plain',
    'csv': 'text/csv',
    'xml': 'text/xml',
    'html': 'text/html',
    'htm': 'text/html',
    'json': 'application/json',
    'md': 'text/markdown',
    
    // Archives
    'zip': 'application/zip',
    'rar': 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    
    // Other
    'apk': 'application/vnd.android.package-archive',
    'exe': 'application/x-msdownload',
    'dmg': 'application/x-apple-diskimage',
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
};

// Get file category for display
export const getFileCategory = (filename: string): 'image' | 'audio' | 'video' | 'document' | 'archive' | 'other' => {
  const mimeType = getMimeType(filename);
  
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('document') ||
    mimeType.includes('word') ||
    mimeType.includes('excel') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('powerpoint') ||
    mimeType.includes('presentation') ||
    mimeType.startsWith('text/')
  ) return 'document';
  if (
    mimeType.includes('zip') ||
    mimeType.includes('rar') ||
    mimeType.includes('7z') ||
    mimeType.includes('tar') ||
    mimeType.includes('gzip')
  ) return 'archive';
  
  return 'other';
};

// Convert data URL to Blob
const dataUrlToBlob = (dataUrl: string): Blob => {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const b64 = atob(parts[1]);
  const n = b64.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    u8arr[i] = b64.charCodeAt(i);
  }
  return new Blob([u8arr], { type: mime });
};

// Convert data URL to temporary file path (for native platforms)
const dataUrlToTempFile = async (dataUrl: string, filename: string): Promise<string> => {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    
    // Extract base64 data
    const base64Data = dataUrl.split(',')[1];
    
    // Generate unique filename
    const uniqueFilename = `temp_${Date.now()}_${filename}`;
    
    // Write to cache directory
    const result = await Filesystem.writeFile({
      path: uniqueFilename,
      data: base64Data,
      directory: Directory.Cache,
    });
    
    return result.uri;
  } catch (e) {
    console.error('Failed to create temp file:', e);
    throw e;
  }
};

// Open file with native "Open with" dialog
export const openFileWithSystem = async (
  dataUrl: string,
  filename: string,
  mimeType?: string
): Promise<boolean> => {
  const actualMimeType = mimeType || getMimeType(filename);
  
  // Check if on native platform
  if (Capacitor.isNativePlatform()) {
    try {
      const opener = await initFileOpener();
      
      if (opener) {
        // Create temporary file
        const filePath = await dataUrlToTempFile(dataUrl, filename);
        
        // Open with system dialog
        await opener.open({
          filePath: filePath,
          contentType: actualMimeType,
          openWithDefault: false, // Show "Open with" dialog instead of default app
        });
        
        return true;
      }
    } catch (e: any) {
      console.error('Failed to open file with system:', e);
      
      // Show user-friendly error
      if (e?.message?.includes('No app found')) {
        toast.error('No app found to open this file type');
      } else {
        toast.error('Failed to open file');
      }
      
      return false;
    }
  }
  
  // Fallback for web: download the file
  try {
    const blob = dataUrlToBlob(dataUrl);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (e) {
    console.error('Failed to download file:', e);
    toast.error('Failed to download file');
    return false;
  }
};

// Check if file can be previewed in-app
export const canPreviewInApp = (filename: string): boolean => {
  const category = getFileCategory(filename);
  // Can preview images, some audio, and PDF in-app
  return category === 'image' || category === 'audio';
};

// Clean up temporary files (call periodically or on app close)
export const cleanupTempFiles = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    
    const files = await Filesystem.readdir({
      path: '',
      directory: Directory.Cache,
    });
    
    // Delete files older than 1 hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    for (const file of files.files) {
      if (file.name.startsWith('temp_')) {
        const timestamp = parseInt(file.name.split('_')[1] || '0', 10);
        if (timestamp < oneHourAgo) {
          try {
            await Filesystem.deleteFile({
              path: file.name,
              directory: Directory.Cache,
            });
          } catch { }
        }
      }
    }
  } catch (e) {
    console.warn('Failed to cleanup temp files:', e);
  }
};
