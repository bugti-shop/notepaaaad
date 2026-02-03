import { Note } from '@/types/note';
import { loadNotesFromDB, saveNotesToDB } from '@/utils/noteStorage';
import { getSetting, setSetting } from '@/utils/settingsStorage';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';

// File names in Google Drive appDataFolder
const SYNC_FILES = {
  notes: 'nota_notes.json',
  tasks: 'nota_tasks.json',
  folders: 'nota_folders.json',
  sections: 'nota_sections.json',
  settings: 'nota_settings.json',
  activity: 'nota_activity.json',
  media: 'nota_media_index.json',
};

interface SyncMetadata {
  lastSyncTime: string;
  deviceId: string;
  version: number;
}

interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

// Generate unique device ID
const getDeviceId = async (): Promise<string> => {
  let deviceId = await getSetting<string>('device_id', '');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await setSetting('device_id', deviceId);
  }
  return deviceId;
};

// Make authenticated request to Google Drive API
const driveRequest = async (
  accessToken: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED');
  }

  return response;
};

// Find a file in appDataFolder by name
const findFile = async (accessToken: string, fileName: string): Promise<DriveFile | null> => {
  try {
    const query = encodeURIComponent(`name='${fileName}' and 'appDataFolder' in parents and trashed=false`);
    const response = await driveRequest(
      accessToken,
      `${DRIVE_API_BASE}/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime)`
    );

    if (!response.ok) {
      console.error('Find file error:', await response.text());
      return null;
    }

    const data = await response.json();
    return data.files?.[0] || null;
  } catch (error) {
    console.error('Find file error:', error);
    return null;
  }
};

// Read file content from Google Drive
const readFile = async <T>(accessToken: string, fileId: string): Promise<T | null> => {
  try {
    const response = await driveRequest(
      accessToken,
      `${DRIVE_API_BASE}/files/${fileId}?alt=media`
    );

    if (!response.ok) {
      console.error('Read file error:', await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Read file error:', error);
    return null;
  }
};

// Create or update a file in appDataFolder
const writeFile = async <T>(
  accessToken: string,
  fileName: string,
  content: T,
  existingFileId?: string
): Promise<string | null> => {
  try {
    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      ...(existingFileId ? {} : { parents: ['appDataFolder'] }),
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const body =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(content) +
      closeDelimiter;

    const url = existingFileId
      ? `${DRIVE_UPLOAD_BASE}/files/${existingFileId}?uploadType=multipart`
      : `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart`;

    const response = await driveRequest(accessToken, url, {
      method: existingFileId ? 'PATCH' : 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body,
    });

    if (!response.ok) {
      console.error('Write file error:', await response.text());
      return null;
    }

    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error('Write file error:', error);
    return null;
  }
};

// Delete a file from Google Drive
const deleteFile = async (accessToken: string, fileId: string): Promise<boolean> => {
  try {
    const response = await driveRequest(accessToken, `${DRIVE_API_BASE}/files/${fileId}`, {
      method: 'DELETE',
    });
    return response.ok || response.status === 204;
  } catch (error) {
    console.error('Delete file error:', error);
    return false;
  }
};

// Sync data type with conflict resolution
interface SyncableData<T> {
  data: T;
  metadata: SyncMetadata;
}

// Get local data with metadata
const getLocalDataWithMetadata = async <T>(
  key: string,
  getData: () => Promise<T>
): Promise<SyncableData<T>> => {
  const data = await getData();
  const lastSyncTime = await getSetting<string>(`sync_${key}_time`, new Date(0).toISOString());
  const deviceId = await getDeviceId();
  
  return {
    data,
    metadata: {
      lastSyncTime,
      deviceId,
      version: 1,
    },
  };
};

// Conflict resolution: newer timestamp wins
const resolveConflict = <T>(
  local: SyncableData<T>,
  remote: SyncableData<T>
): { winner: 'local' | 'remote'; data: T } => {
  const localTime = new Date(local.metadata.lastSyncTime).getTime();
  const remoteTime = new Date(remote.metadata.lastSyncTime).getTime();

  if (localTime > remoteTime) {
    return { winner: 'local', data: local.data };
  }
  return { winner: 'remote', data: remote.data };
};

// Main sync class
class GoogleDriveSyncManager {
  private accessToken: string | null = null;
  private syncInProgress = false;
  private syncQueue: string[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private refreshTokenFn: (() => Promise<string | null>) | null = null;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  setRefreshTokenFn(fn: () => Promise<string | null>) {
    this.refreshTokenFn = fn;
  }

  private async ensureValidToken(): Promise<string | null> {
    if (!this.accessToken) return null;
    
    // Try current token first
    try {
      const response = await fetch(`${DRIVE_API_BASE}/about?fields=user`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      if (response.ok) return this.accessToken;
      
      // Token expired, try to refresh
      if (response.status === 401 && this.refreshTokenFn) {
        const newToken = await this.refreshTokenFn();
        if (newToken) {
          this.accessToken = newToken;
          return newToken;
        }
      }
    } catch (error) {
      console.error('Token validation error:', error);
    }
    return null;
  }

  // Sync notes
  async syncNotes(): Promise<boolean> {
    const token = await this.ensureValidToken();
    if (!token) return false;

    try {
      // Get local notes
      const localNotes = await loadNotesFromDB();
      const localData = await getLocalDataWithMetadata('notes', async () => localNotes);

      // Find remote file
      const remoteFile = await findFile(token, SYNC_FILES.notes);

      if (remoteFile) {
        // Remote exists, check for conflicts
        const remoteData = await readFile<SyncableData<Note[]>>(token, remoteFile.id);
        
        if (remoteData) {
          const { winner, data } = resolveConflict(localData, remoteData);
          
          if (winner === 'remote') {
            // Update local with remote data
            const restoredNotes = data.map(note => ({
              ...note,
              createdAt: new Date(note.createdAt),
              updatedAt: new Date(note.updatedAt),
              voiceRecordings: note.voiceRecordings?.map(r => ({
                ...r,
                timestamp: new Date(r.timestamp),
              })) || [],
            }));
            await saveNotesToDB(restoredNotes);
            console.log('Notes restored from cloud');
          } else {
            // Update remote with local data
            const syncData: SyncableData<Note[]> = {
              data: localNotes,
              metadata: {
                lastSyncTime: new Date().toISOString(),
                deviceId: await getDeviceId(),
                version: 1,
              },
            };
            await writeFile(token, SYNC_FILES.notes, syncData, remoteFile.id);
            console.log('Notes synced to cloud');
          }
        }
      } else {
        // No remote file, create it
        const syncData: SyncableData<Note[]> = {
          data: localNotes,
          metadata: {
            lastSyncTime: new Date().toISOString(),
            deviceId: await getDeviceId(),
            version: 1,
          },
        };
        await writeFile(token, SYNC_FILES.notes, syncData);
        console.log('Notes uploaded to cloud (first sync)');
      }

      await setSetting('sync_notes_time', new Date().toISOString());
      return true;
    } catch (error) {
      console.error('Notes sync error:', error);
      return false;
    }
  }

  // Sync tasks
  async syncTasks(): Promise<boolean> {
    const token = await this.ensureValidToken();
    if (!token) return false;

    try {
      const { loadTasksFromDB, saveTasksToDB } = await import('@/utils/taskStorage');
      
      const localTasks = await loadTasksFromDB();
      const localData = await getLocalDataWithMetadata('tasks', async () => localTasks);

      const remoteFile = await findFile(token, SYNC_FILES.tasks);

      if (remoteFile) {
        const remoteData = await readFile<SyncableData<any[]>>(token, remoteFile.id);
        
        if (remoteData) {
          const { winner, data } = resolveConflict(localData, remoteData);
          
          if (winner === 'remote') {
            await saveTasksToDB(data);
            console.log('Tasks restored from cloud');
          } else {
            const syncData: SyncableData<any[]> = {
              data: localTasks,
              metadata: {
                lastSyncTime: new Date().toISOString(),
                deviceId: await getDeviceId(),
                version: 1,
              },
            };
            await writeFile(token, SYNC_FILES.tasks, syncData, remoteFile.id);
            console.log('Tasks synced to cloud');
          }
        }
      } else {
        const syncData: SyncableData<any[]> = {
          data: localTasks,
          metadata: {
            lastSyncTime: new Date().toISOString(),
            deviceId: await getDeviceId(),
            version: 1,
          },
        };
        await writeFile(token, SYNC_FILES.tasks, syncData);
        console.log('Tasks uploaded to cloud (first sync)');
      }

      await setSetting('sync_tasks_time', new Date().toISOString());
      return true;
    } catch (error) {
      console.error('Tasks sync error:', error);
      return false;
    }
  }

  // Sync folders
  async syncFolders(): Promise<boolean> {
    const token = await this.ensureValidToken();
    if (!token) return false;

    try {
      const { loadFolders, saveFolders } = await import('@/utils/folderStorage');
      
      const localFolders = await loadFolders();
      const localData = await getLocalDataWithMetadata('folders', async () => localFolders);

      const remoteFile = await findFile(token, SYNC_FILES.folders);

      if (remoteFile) {
        const remoteData = await readFile<SyncableData<any[]>>(token, remoteFile.id);
        
        if (remoteData) {
          const { winner, data } = resolveConflict(localData, remoteData);
          
          if (winner === 'remote') {
            await saveFolders(data);
            console.log('Folders restored from cloud');
          } else {
            const syncData: SyncableData<any[]> = {
              data: localFolders,
              metadata: {
                lastSyncTime: new Date().toISOString(),
                deviceId: await getDeviceId(),
                version: 1,
              },
            };
            await writeFile(token, SYNC_FILES.folders, syncData, remoteFile.id);
            console.log('Folders synced to cloud');
          }
        }
      } else {
        const syncData: SyncableData<any[]> = {
          data: localFolders,
          metadata: {
            lastSyncTime: new Date().toISOString(),
            deviceId: await getDeviceId(),
            version: 1,
          },
        };
        await writeFile(token, SYNC_FILES.folders, syncData);
        console.log('Folders uploaded to cloud (first sync)');
      }

      await setSetting('sync_folders_time', new Date().toISOString());
      return true;
    } catch (error) {
      console.error('Folders sync error:', error);
      return false;
    }
  }

  // Sync sections (task sections)
  async syncSections(): Promise<boolean> {
    const token = await this.ensureValidToken();
    if (!token) return false;

    try {
      const sections = await getSetting<any[]>('todo_sections', []);
      const localData = await getLocalDataWithMetadata('sections', async () => sections);

      const remoteFile = await findFile(token, SYNC_FILES.sections);

      if (remoteFile) {
        const remoteData = await readFile<SyncableData<any[]>>(token, remoteFile.id);
        
        if (remoteData) {
          const { winner, data } = resolveConflict(localData, remoteData);
          
          if (winner === 'remote') {
            await setSetting('todo_sections', data);
            console.log('Sections restored from cloud');
          } else {
            const syncData: SyncableData<any[]> = {
              data: sections,
              metadata: {
                lastSyncTime: new Date().toISOString(),
                deviceId: await getDeviceId(),
                version: 1,
              },
            };
            await writeFile(token, SYNC_FILES.sections, syncData, remoteFile.id);
            console.log('Sections synced to cloud');
          }
        }
      } else {
        const syncData: SyncableData<any[]> = {
          data: sections,
          metadata: {
            lastSyncTime: new Date().toISOString(),
            deviceId: await getDeviceId(),
            version: 1,
          },
        };
        await writeFile(token, SYNC_FILES.sections, syncData);
        console.log('Sections uploaded to cloud (first sync)');
      }

      await setSetting('sync_sections_time', new Date().toISOString());
      return true;
    } catch (error) {
      console.error('Sections sync error:', error);
      return false;
    }
  }

  // Sync settings
  async syncSettings(): Promise<boolean> {
    const token = await this.ensureValidToken();
    if (!token) return false;

    try {
      const { getAllSettings } = await import('@/utils/settingsStorage');
      const allSettings = await getAllSettings();
      
      // Filter out sync-related settings to avoid circular issues
      const syncableSettings = Object.fromEntries(
        Object.entries(allSettings).filter(([key]) => 
          !key.startsWith('sync_') && 
          !key.startsWith('device_') &&
          !key.startsWith('google_')
        )
      );
      
      const localData = await getLocalDataWithMetadata('settings', async () => syncableSettings);

      const remoteFile = await findFile(token, SYNC_FILES.settings);

      if (remoteFile) {
        const remoteData = await readFile<SyncableData<Record<string, any>>>(token, remoteFile.id);
        
        if (remoteData) {
          const { winner, data } = resolveConflict(localData, remoteData);
          
          if (winner === 'remote') {
            // Restore each setting
            for (const [key, value] of Object.entries(data)) {
              await setSetting(key, value);
            }
            console.log('Settings restored from cloud');
          } else {
            const syncData: SyncableData<Record<string, any>> = {
              data: syncableSettings,
              metadata: {
                lastSyncTime: new Date().toISOString(),
                deviceId: await getDeviceId(),
                version: 1,
              },
            };
            await writeFile(token, SYNC_FILES.settings, syncData, remoteFile.id);
            console.log('Settings synced to cloud');
          }
        }
      } else {
        const syncData: SyncableData<Record<string, any>> = {
          data: syncableSettings,
          metadata: {
            lastSyncTime: new Date().toISOString(),
            deviceId: await getDeviceId(),
            version: 1,
          },
        };
        await writeFile(token, SYNC_FILES.settings, syncData);
        console.log('Settings uploaded to cloud (first sync)');
      }

      await setSetting('sync_settings_time', new Date().toISOString());
      return true;
    } catch (error) {
      console.error('Settings sync error:', error);
      return false;
    }
  }

  // Sync activity log
  async syncActivity(): Promise<boolean> {
    const token = await this.ensureValidToken();
    if (!token) return false;

    try {
      const { getActivities } = await import('@/utils/activityLogger');
      const activityLog = await getActivities();
      const localData = await getLocalDataWithMetadata('activity', async () => activityLog);

      const remoteFile = await findFile(token, SYNC_FILES.activity);

      if (remoteFile) {
        const remoteData = await readFile<SyncableData<any[]>>(token, remoteFile.id);
        
        if (remoteData) {
          const { winner, data } = resolveConflict(localData, remoteData);
          
          if (winner === 'remote') {
            // Merge activity logs - keep all unique entries, save via settings
            const mergedLog = [...data, ...activityLog].reduce((acc, entry) => {
              if (!acc.find((e: any) => e.id === entry.id)) {
                acc.push(entry);
              }
              return acc;
            }, [] as any[]);
            // Save merged log directly to settings storage
            await setSetting('userActivityLog', mergedLog);
            console.log('Activity log merged from cloud');
          } else {
            const syncData: SyncableData<any[]> = {
              data: activityLog,
              metadata: {
                lastSyncTime: new Date().toISOString(),
                deviceId: await getDeviceId(),
                version: 1,
              },
            };
            await writeFile(token, SYNC_FILES.activity, syncData, remoteFile.id);
            console.log('Activity log synced to cloud');
          }
        }
      } else {
        const syncData: SyncableData<any[]> = {
          data: activityLog,
          metadata: {
            lastSyncTime: new Date().toISOString(),
            deviceId: await getDeviceId(),
            version: 1,
          },
        };
        await writeFile(token, SYNC_FILES.activity, syncData);
        console.log('Activity log uploaded to cloud (first sync)');
      }

      await setSetting('sync_activity_time', new Date().toISOString());
      return true;
    } catch (error) {
      console.error('Activity sync error:', error);
      return false;
    }
  }

  // Sync media (images, audio) - stores index and references
  async syncMedia(): Promise<boolean> {
    const token = await this.ensureValidToken();
    if (!token) return false;

    try {
      // For media, we sync an index of media references
      // The actual media data stays in IndexedDB locally
      // This allows other devices to know what media exists
      const mediaIndex = await this.getLocalMediaIndex();
      const localData = await getLocalDataWithMetadata('media', async () => mediaIndex);

      const remoteFile = await findFile(token, SYNC_FILES.media);

      if (remoteFile) {
        const remoteData = await readFile<SyncableData<any>>(token, remoteFile.id);
        
        if (remoteData) {
          const { winner, data } = resolveConflict(localData, remoteData);
          
          if (winner === 'remote') {
            // Store the remote media index locally
            await setSetting('media_index', JSON.stringify(data));
            console.log('Media index restored from cloud');
          } else {
            const syncData: SyncableData<any> = {
              data: mediaIndex,
              metadata: {
                lastSyncTime: new Date().toISOString(),
                deviceId: await getDeviceId(),
                version: 1,
              },
            };
            await writeFile(token, SYNC_FILES.media, syncData, remoteFile.id);
            console.log('Media index synced to cloud');
          }
        }
      } else {
        const syncData: SyncableData<any> = {
          data: mediaIndex,
          metadata: {
            lastSyncTime: new Date().toISOString(),
            deviceId: await getDeviceId(),
            version: 1,
          },
        };
        await writeFile(token, SYNC_FILES.media, syncData);
        console.log('Media index uploaded to cloud (first sync)');
      }

      await setSetting('sync_media_time', new Date().toISOString());
      return true;
    } catch (error) {
      console.error('Media sync error:', error);
      return false;
    }
  }

  // Get local media index from storage
  private async getLocalMediaIndex(): Promise<{ images: string[]; audio: string[] }> {
    try {
      const indexStr = await getSetting<string>('media_index', '');
      if (indexStr) {
        return JSON.parse(indexStr);
      }
    } catch (e) {
      console.error('Failed to parse media index:', e);
    }
    return { images: [], audio: [] };
  }

  // Full sync of all data - NO DELAYS
  async syncAll(): Promise<{ success: boolean; errors: string[] }> {
    if (this.syncInProgress) {
      return { success: false, errors: ['Sync already in progress'] };
    }

    this.syncInProgress = true;
    const errors: string[] = [];

    try {
      // Sync all data types in parallel for speed
      const results = await Promise.allSettled([
        this.syncNotes(),
        this.syncTasks(),
        this.syncFolders(),
        this.syncSections(),
        this.syncSettings(),
        this.syncActivity(),
        this.syncMedia(),
      ]);

      const types = ['notes', 'tasks', 'folders', 'sections', 'settings', 'activity', 'media'];
      results.forEach((result, index) => {
        if (result.status === 'rejected' || (result.status === 'fulfilled' && !result.value)) {
          errors.push(`Failed to sync ${types[index]}`);
        }
      });

      await setSetting('last_full_sync', new Date().toISOString());
      
      // Dispatch sync complete event
      window.dispatchEvent(new CustomEvent('syncComplete', { 
        detail: { success: errors.length === 0, errors } 
      }));

      return { success: errors.length === 0, errors };
    } finally {
      this.syncInProgress = false;
    }
  }

  // Instant sync - no debounce, syncs immediately
  async instantSync(dataType: 'notes' | 'tasks' | 'folders' | 'sections' | 'settings' | 'activity' | 'media'): Promise<boolean> {
    if (!this.accessToken) return false;

    switch (dataType) {
      case 'notes':
        return this.syncNotes();
      case 'tasks':
        return this.syncTasks();
      case 'folders':
        return this.syncFolders();
      case 'sections':
        return this.syncSections();
      case 'settings':
        return this.syncSettings();
      case 'activity':
        return this.syncActivity();
      case 'media':
        return this.syncMedia();
      default:
        return false;
    }
  }

  // Keep debouncedSync for backward compatibility but with 0 delay
  debouncedSync(dataType: 'notes' | 'tasks' | 'folders', delay: number = 0) {
    // Instant sync - no delay
    this.instantSync(dataType);
  }

  // Get last sync time
  async getLastSyncTime(): Promise<Date | null> {
    const lastSync = await getSetting<string>('last_full_sync', '');
    return lastSync ? new Date(lastSync) : null;
  }

  // Clear all synced data from cloud
  async clearCloudData(): Promise<boolean> {
    const token = await this.ensureValidToken();
    if (!token) return false;

    try {
      for (const fileName of Object.values(SYNC_FILES)) {
        const file = await findFile(token, fileName);
        if (file) {
          await deleteFile(token, file.id);
        }
      }
      console.log('Cloud data cleared');
      return true;
    } catch (error) {
      console.error('Clear cloud data error:', error);
      return false;
    }
  }
}

export const googleDriveSyncManager = new GoogleDriveSyncManager();

// Listen for data change events and trigger INSTANT sync
if (typeof window !== 'undefined') {
  window.addEventListener('notesUpdated', () => {
    googleDriveSyncManager.instantSync('notes');
  });

  window.addEventListener('tasksUpdated', () => {
    googleDriveSyncManager.instantSync('tasks');
  });

  window.addEventListener('foldersUpdated', () => {
    googleDriveSyncManager.instantSync('folders');
  });

  window.addEventListener('sectionsUpdated', () => {
    googleDriveSyncManager.instantSync('sections');
  });

  window.addEventListener('settingsUpdated', () => {
    googleDriveSyncManager.instantSync('settings');
  });

  window.addEventListener('mediaUpdated', () => {
    googleDriveSyncManager.instantSync('media');
  });

  // Listen for auth changes
  window.addEventListener('googleAuthChanged', (event: any) => {
    const { user, signedIn } = event.detail || {};
    if (signedIn && user?.authentication?.accessToken) {
      googleDriveSyncManager.setAccessToken(user.authentication.accessToken);
      // Trigger initial sync on sign in - immediately
      googleDriveSyncManager.syncAll();
    } else {
      googleDriveSyncManager.setAccessToken(null);
    }
  });
}
