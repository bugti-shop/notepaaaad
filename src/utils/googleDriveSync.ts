import { Note, SyncStatus } from '@/types/note';
import { loadNotesFromDB, saveNotesToDB } from '@/utils/noteStorage';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import { 
  mergeNotesWithConflictDetection, 
  addToSyncQueue, 
  removeFromSyncQueue,
  markSyncFailed,
  getSyncState,
  getLastSyncCursor,
  setLastSyncCursor,
  cleanupSyncQueue,
  cleanupResolvedConflicts,
} from '@/utils/syncQueue';
import { migrateNoteToSyncable, getDeviceId } from '@/utils/noteDefaults';

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
  appLock: 'nota_app_lock.json',
  manifest: 'nota_sync_manifest.json', // New: tracks sync state
};

interface SyncMetadata {
  lastSyncTime: string;
  deviceId: string;
  version: number;
  cursor?: string; // For incremental sync
}

interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
}

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

// Conflict resolution: MERGE - never overwrite, combine both datasets
const resolveConflict = <T>(
  local: SyncableData<T>,
  remote: SyncableData<T>
): { winner: 'local' | 'remote' | 'merge'; data: T; localData?: T; remoteData?: T } => {
  // Always return merge so we can combine data instead of overwriting
  return { winner: 'merge', data: local.data, localData: local.data, remoteData: remote.data };
};

// Helper to merge arrays by ID (keeps all unique items, local takes priority for conflicts)
const mergeArraysById = <T extends { id: string }>(local: T[], remote: T[]): T[] => {
  const merged = new Map<string, T>();
  
  // Add remote items first
  for (const item of remote) {
    merged.set(item.id, item);
  }
  
  // Then add local items (overwrites remote if same ID exists - local is newer)
  for (const item of local) {
    merged.set(item.id, item);
  }
  
  return Array.from(merged.values());
};

// Helper to merge notes - preserves both local and remote, local takes priority for duplicates
const mergeNotes = (local: Note[], remote: Note[]): Note[] => {
  const merged = new Map<string, Note>();
  
  // Add remote notes first
  for (const note of remote) {
    merged.set(note.id, {
      ...note,
      createdAt: new Date(note.createdAt),
      updatedAt: new Date(note.updatedAt),
      voiceRecordings: note.voiceRecordings?.map(r => ({
        ...r,
        timestamp: new Date(r.timestamp),
      })) || [],
    });
  }
  
  // Add local notes (overwrites remote if same ID but keeps unique remote notes)
  for (const note of local) {
    const existing = merged.get(note.id);
    if (existing) {
      // If local is newer, use local; otherwise keep existing
      const localTime = new Date(note.updatedAt).getTime();
      const remoteTime = new Date(existing.updatedAt).getTime();
      if (localTime >= remoteTime) {
        merged.set(note.id, note);
      }
    } else {
      merged.set(note.id, note);
    }
  }
  
  return Array.from(merged.values());
};

// Helper to merge tasks - preserves both local and remote
const mergeTasks = (local: any[], remote: any[]): any[] => {
  const merged = new Map<string, any>();
  
  // Add remote tasks first
  for (const task of remote) {
    merged.set(task.id, task);
  }
  
  // Add local tasks (local takes priority for same ID)
  for (const task of local) {
    const existing = merged.get(task.id);
    if (existing) {
      // Compare by updatedAt or completedAt
      const localTime = task.updatedAt ? new Date(task.updatedAt).getTime() : 0;
      const remoteTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      if (localTime >= remoteTime) {
        merged.set(task.id, task);
      }
    } else {
      merged.set(task.id, task);
    }
  }
  
  return Array.from(merged.values());
};

// Helper to merge folders
const mergeFolders = (local: any[], remote: any[]): any[] => {
  const merged = new Map<string, any>();
  
  for (const folder of remote) {
    merged.set(folder.id, folder);
  }
  
  for (const folder of local) {
    merged.set(folder.id, folder);
  }
  
  return Array.from(merged.values());
};

// Helper to merge sections
const mergeSections = (local: any[], remote: any[]): any[] => {
  const merged = new Map<string, any>();
  
  for (const section of remote) {
    merged.set(section.id, section);
  }
  
  for (const section of local) {
    merged.set(section.id, section);
  }
  
  return Array.from(merged.values());
};

// Helper to merge settings (local takes priority)
const mergeSettings = (local: Record<string, any>, remote: Record<string, any>): Record<string, any> => {
  return { ...remote, ...local };
};

// Helper to merge activity logs (keeps all unique entries)
const mergeActivityLogs = (local: any[], remote: any[]): any[] => {
  const merged = new Map<string, any>();
  
  for (const entry of remote) {
    merged.set(entry.id, entry);
  }
  
  for (const entry of local) {
    merged.set(entry.id, entry);
  }
  
  // Sort by timestamp descending
  return Array.from(merged.values()).sort((a, b) => {
    const timeA = new Date(a.timestamp || a.createdAt || 0).getTime();
    const timeB = new Date(b.timestamp || b.createdAt || 0).getTime();
    return timeB - timeA;
  });
};

// Main sync class
class GoogleDriveSyncManager {
  private accessToken: string | null = null;
  private syncInProgress = false;
  private syncQueue: string[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private refreshTokenFn: (() => Promise<string | null>) | null = null;
  private backgroundSyncInterval: NodeJS.Timeout | null = null;
  private isBackgroundSyncEnabled = false;

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

  // Sync notes - CONFLICT-SAFE mode with version tracking
  async syncNotes(): Promise<boolean> {
    const token = await this.ensureValidToken();
    if (!token) return false;

    try {
      // Get local notes and migrate them to include sync fields
      const rawLocalNotes = await loadNotesFromDB();
      const localNotes: Note[] = rawLocalNotes.map(migrateNoteToSyncable);

      // Find remote file
      const remoteFile = await findFile(token, SYNC_FILES.notes);

      if (remoteFile) {
        // Remote exists - use conflict-safe merge
        const remoteData = await readFile<SyncableData<Note[]>>(token, remoteFile.id);
        
        if (remoteData && remoteData.data) {
          // Migrate remote notes too
          const remoteNotes = remoteData.data.map(migrateNoteToSyncable);
          
          // Use conflict detection and resolution
          const { merged, conflicts } = await mergeNotesWithConflictDetection(localNotes, remoteNotes);
          
          // Mark all merged notes as synced (except those with conflicts)
          const syncedNotes = merged.map(note => ({
            ...note,
            syncStatus: note.hasConflict ? 'conflict' as SyncStatus : 'synced' as SyncStatus,
            isDirty: note.hasConflict ? note.isDirty : false,
            lastSyncedAt: note.hasConflict ? note.lastSyncedAt : new Date(),
          }));
          
          // Save merged data locally
          await saveNotesToDB(syncedNotes);
          
          const conflictCount = conflicts.length;
          console.log(`[Sync] Notes merged: ${localNotes.length} local + ${remoteNotes.length} remote = ${syncedNotes.length} total${conflictCount > 0 ? ` (${conflictCount} conflicts)` : ''}`);
          
          // Upload merged data to cloud
          const syncData: SyncableData<Note[]> = {
            data: syncedNotes,
            metadata: {
              lastSyncTime: new Date().toISOString(),
              deviceId: await getDeviceId(),
              version: (remoteData.metadata?.version || 0) + 1,
              cursor: Date.now().toString(),
            },
          };
          await writeFile(token, SYNC_FILES.notes, syncData, remoteFile.id);
          
          // Update sync cursor
          await setLastSyncCursor(Date.now().toString());
          
          // Clear completed items from sync queue
          for (const note of syncedNotes) {
            if (!note.hasConflict) {
              await removeFromSyncQueue(note.id);
            }
          }
          
          // Dispatch events
          window.dispatchEvent(new CustomEvent('notesRestored'));
          if (conflictCount > 0) {
            window.dispatchEvent(new CustomEvent('syncConflicts', { detail: { count: conflictCount } }));
          }
        }
      } else {
        // No remote file, create it with local data (mark all as synced)
        const syncedNotes = localNotes.map(note => ({
          ...note,
          syncStatus: 'synced' as SyncStatus,
          isDirty: false,
          lastSyncedAt: new Date(),
        }));
        
        const syncData: SyncableData<Note[]> = {
          data: syncedNotes,
          metadata: {
            lastSyncTime: new Date().toISOString(),
            deviceId: await getDeviceId(),
            version: 1,
            cursor: Date.now().toString(),
          },
        };
        await writeFile(token, SYNC_FILES.notes, syncData);
        
        // Save synced notes locally
        await saveNotesToDB(syncedNotes);
        
        // Update sync cursor
        await setLastSyncCursor(Date.now().toString());
        
        console.log('[Sync] Notes uploaded to cloud (first sync)');
      }

      await setSetting('sync_notes_time', new Date().toISOString());
      
      // Cleanup old resolved conflicts
      await cleanupResolvedConflicts();
      
      return true;
    } catch (error: any) {
      console.error('[Sync] Notes sync error:', error);
      
      // Mark dirty notes as failed in queue
      const rawLocalNotes = await loadNotesFromDB();
      for (const note of rawLocalNotes) {
        if ((note as any).isDirty) {
          await markSyncFailed(note.id, error?.message || 'Unknown error');
        }
      }
      
      return false;
    }
  }

  // Sync tasks - MERGE mode (never overwrites, combines both)
  async syncTasks(): Promise<boolean> {
    const token = await this.ensureValidToken();
    if (!token) return false;

    try {
      const { loadTasksFromDB, saveTasksToDB } = await import('@/utils/taskStorage');
      
      const localTasks = await loadTasksFromDB();

      const remoteFile = await findFile(token, SYNC_FILES.tasks);

      if (remoteFile) {
        const remoteData = await readFile<SyncableData<any[]>>(token, remoteFile.id);
        
        if (remoteData && remoteData.data) {
          // Merge local and remote tasks
          const mergedTasks = mergeTasks(localTasks, remoteData.data);
          
          // Save merged data locally
          await saveTasksToDB(mergedTasks);
          console.log(`Tasks merged: ${localTasks.length} local + ${remoteData.data.length} remote = ${mergedTasks.length} total`);
          
          // Upload merged data to cloud
          const syncData: SyncableData<any[]> = {
            data: mergedTasks,
            metadata: {
              lastSyncTime: new Date().toISOString(),
              deviceId: await getDeviceId(),
              version: 1,
            },
          };
          await writeFile(token, SYNC_FILES.tasks, syncData, remoteFile.id);
          
          // Dispatch event to update UI
          window.dispatchEvent(new CustomEvent('tasksRestored'));
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

  // Sync folders - MERGE mode
  async syncFolders(): Promise<boolean> {
    const token = await this.ensureValidToken();
    if (!token) return false;

    try {
      const { loadFolders, saveFolders } = await import('@/utils/folderStorage');
      
      const localFolders = await loadFolders();

      const remoteFile = await findFile(token, SYNC_FILES.folders);

      if (remoteFile) {
        const remoteData = await readFile<SyncableData<any[]>>(token, remoteFile.id);
        
        if (remoteData && remoteData.data) {
          // Merge folders
          const mergedFolders = mergeFolders(localFolders, remoteData.data);
          
          await saveFolders(mergedFolders);
          console.log(`Folders merged: ${localFolders.length} local + ${remoteData.data.length} remote = ${mergedFolders.length} total`);
          
          const syncData: SyncableData<any[]> = {
            data: mergedFolders,
            metadata: {
              lastSyncTime: new Date().toISOString(),
              deviceId: await getDeviceId(),
              version: 1,
            },
          };
          await writeFile(token, SYNC_FILES.folders, syncData, remoteFile.id);
          
          window.dispatchEvent(new CustomEvent('foldersRestored'));
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

  // Sync sections - MERGE mode
  async syncSections(): Promise<boolean> {
    const token = await this.ensureValidToken();
    if (!token) return false;

    try {
      const sections = await getSetting<any[]>('todo_sections', []);

      const remoteFile = await findFile(token, SYNC_FILES.sections);

      if (remoteFile) {
        const remoteData = await readFile<SyncableData<any[]>>(token, remoteFile.id);
        
        if (remoteData && remoteData.data) {
          // Merge sections
          const mergedSections = mergeSections(sections, remoteData.data);
          
          await setSetting('todo_sections', mergedSections);
          console.log(`Sections merged: ${sections.length} local + ${remoteData.data.length} remote = ${mergedSections.length} total`);
          
          const syncData: SyncableData<any[]> = {
            data: mergedSections,
            metadata: {
              lastSyncTime: new Date().toISOString(),
              deviceId: await getDeviceId(),
              version: 1,
            },
          };
          await writeFile(token, SYNC_FILES.sections, syncData, remoteFile.id);
          
          window.dispatchEvent(new CustomEvent('sectionsRestored'));
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

  // Sync settings - MERGE mode (local takes priority)
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

      const remoteFile = await findFile(token, SYNC_FILES.settings);

      if (remoteFile) {
        const remoteData = await readFile<SyncableData<Record<string, any>>>(token, remoteFile.id);
        
        if (remoteData && remoteData.data) {
          // Merge settings (local takes priority)
          const mergedSettings = mergeSettings(syncableSettings, remoteData.data);
          
          // Save merged settings locally
          for (const [key, value] of Object.entries(mergedSettings)) {
            if (!syncableSettings.hasOwnProperty(key)) {
              // Only restore settings that don't exist locally
              await setSetting(key, value);
            }
          }
          console.log('Settings merged from cloud (local priority)');
          
          const syncData: SyncableData<Record<string, any>> = {
            data: mergedSettings,
            metadata: {
              lastSyncTime: new Date().toISOString(),
              deviceId: await getDeviceId(),
              version: 1,
            },
          };
          await writeFile(token, SYNC_FILES.settings, syncData, remoteFile.id);
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

  // Sync activity log - ALWAYS MERGE (keeps all unique activities)
  async syncActivity(): Promise<boolean> {
    const token = await this.ensureValidToken();
    if (!token) return false;

    try {
      const { getActivities } = await import('@/utils/activityLogger');
      const activityLog = await getActivities();

      const remoteFile = await findFile(token, SYNC_FILES.activity);

      if (remoteFile) {
        const remoteData = await readFile<SyncableData<any[]>>(token, remoteFile.id);
        
        if (remoteData && remoteData.data) {
          // Always merge activity logs - keeps all unique entries
          const mergedLog = mergeActivityLogs(activityLog, remoteData.data);
          
          // Save merged log locally
          await setSetting('userActivityLog', mergedLog);
          console.log(`Activity merged: ${activityLog.length} local + ${remoteData.data.length} remote = ${mergedLog.length} total`);
          
          // Upload merged log to cloud
          const syncData: SyncableData<any[]> = {
            data: mergedLog,
            metadata: {
              lastSyncTime: new Date().toISOString(),
              deviceId: await getDeviceId(),
              version: 1,
            },
          };
          await writeFile(token, SYNC_FILES.activity, syncData, remoteFile.id);
          
          window.dispatchEvent(new CustomEvent('activityRestored'));
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

  // Sync App Lock settings (PIN + Security Questions)
  async syncAppLock(): Promise<boolean> {
    const token = await this.ensureValidToken();
    if (!token) return false;

    try {
      const { getAppLockSettings, saveAppLockSettings } = await import('@/utils/appLockStorage');
      
      const localAppLock = await getAppLockSettings();
      const localData = await getLocalDataWithMetadata('appLock', async () => localAppLock);

      const remoteFile = await findFile(token, SYNC_FILES.appLock);

      if (remoteFile) {
        const remoteData = await readFile<SyncableData<any>>(token, remoteFile.id);
        
        if (remoteData) {
          const { winner, data } = resolveConflict(localData, remoteData);
          
          if (winner === 'remote') {
            // Restore App Lock settings from cloud
            await saveAppLockSettings(data);
            console.log('App Lock settings restored from cloud');
          } else {
            const syncData: SyncableData<any> = {
              data: localAppLock,
              metadata: {
                lastSyncTime: new Date().toISOString(),
                deviceId: await getDeviceId(),
                version: 1,
              },
            };
            await writeFile(token, SYNC_FILES.appLock, syncData, remoteFile.id);
            console.log('App Lock settings synced to cloud');
          }
        }
      } else {
        // Only create if app lock is enabled
        if (localAppLock.isEnabled) {
          const syncData: SyncableData<any> = {
            data: localAppLock,
            metadata: {
              lastSyncTime: new Date().toISOString(),
              deviceId: await getDeviceId(),
              version: 1,
            },
          };
          await writeFile(token, SYNC_FILES.appLock, syncData);
          console.log('App Lock settings uploaded to cloud (first sync)');
        }
      }

      await setSetting('sync_appLock_time', new Date().toISOString());
      return true;
    } catch (error) {
      console.error('App Lock sync error:', error);
      return false;
    }
  }

  // Full sync of all data - NO DELAYS with better error recovery
  async syncAll(): Promise<{ success: boolean; errors: string[]; partial: boolean }> {
    if (this.syncInProgress) {
      return { success: false, errors: ['Sync already in progress'], partial: false };
    }

    this.syncInProgress = true;
    const errors: string[] = [];
    const successes: string[] = [];

    try {
      // Sync all data types in parallel for speed
      const results = await Promise.allSettled([
        this.syncNotes().catch(e => { console.error('Notes sync error:', e); return false; }),
        this.syncTasks().catch(e => { console.error('Tasks sync error:', e); return false; }),
        this.syncFolders().catch(e => { console.error('Folders sync error:', e); return false; }),
        this.syncSections().catch(e => { console.error('Sections sync error:', e); return false; }),
        this.syncSettings().catch(e => { console.error('Settings sync error:', e); return false; }),
        this.syncActivity().catch(e => { console.error('Activity sync error:', e); return false; }),
        this.syncMedia().catch(e => { console.error('Media sync error:', e); return false; }),
        this.syncAppLock().catch(e => { console.error('AppLock sync error:', e); return false; }),
      ]);

      const types = ['notes', 'tasks', 'folders', 'sections', 'settings', 'activity', 'media', 'appLock'];
      results.forEach((result, index) => {
        if (result.status === 'rejected' || (result.status === 'fulfilled' && !result.value)) {
          errors.push(types[index]);
        } else {
          successes.push(types[index]);
        }
      });

      await setSetting('last_full_sync', new Date().toISOString());
      
      const isPartial = errors.length > 0 && successes.length > 0;
      const isSuccess = errors.length === 0;
      
      // Dispatch sync complete event with detailed info
      window.dispatchEvent(new CustomEvent('syncComplete', { 
        detail: { 
          success: isSuccess, 
          partial: isPartial,
          errors,
          successes 
        } 
      }));

      return { success: isSuccess, errors, partial: isPartial };
    } finally {
      this.syncInProgress = false;
    }
  }

  // Instant sync - no debounce, syncs immediately
  async instantSync(dataType: 'notes' | 'tasks' | 'folders' | 'sections' | 'settings' | 'activity' | 'media' | 'appLock'): Promise<boolean> {
    if (!this.accessToken) return false;

    try {
      switch (dataType) {
        case 'notes':
          return await this.syncNotes();
        case 'tasks':
          return await this.syncTasks();
        case 'folders':
          return await this.syncFolders();
        case 'sections':
          return await this.syncSections();
        case 'settings':
          return await this.syncSettings();
        case 'activity':
          return await this.syncActivity();
        case 'media':
          return await this.syncMedia();
        case 'appLock':
          return await this.syncAppLock();
        default:
          return false;
      }
    } catch (error) {
      console.error(`Instant sync failed for ${dataType}:`, error);
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

  // Start background sync polling (for real-time cross-device sync)
  startBackgroundSync(intervalMs: number = 1000) {
    if (this.backgroundSyncInterval) {
      clearInterval(this.backgroundSyncInterval);
    }
    
    this.isBackgroundSyncEnabled = true;
    console.log(`[Sync] Background sync started (every ${intervalMs / 1000}s)`);
    
    this.backgroundSyncInterval = setInterval(async () => {
      if (this.accessToken && !this.syncInProgress) {
        console.log('[Sync] Background sync triggered');
        await this.syncAll();
      }
    }, intervalMs);
  }

  // Stop background sync
  stopBackgroundSync() {
    if (this.backgroundSyncInterval) {
      clearInterval(this.backgroundSyncInterval);
      this.backgroundSyncInterval = null;
    }
    this.isBackgroundSyncEnabled = false;
    console.log('[Sync] Background sync stopped');
  }

  // Check if background sync is running
  isBackgroundSyncRunning(): boolean {
    return this.isBackgroundSyncEnabled;
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

  window.addEventListener('appLockUpdated', () => {
    googleDriveSyncManager.instantSync('appLock');
  });

  // Listen for auth changes
  window.addEventListener('googleAuthChanged', (event: any) => {
    const { user, signedIn } = event.detail || {};
    if (signedIn && user?.authentication?.accessToken) {
      googleDriveSyncManager.setAccessToken(user.authentication.accessToken);
      // Trigger initial sync on sign in - immediately
      googleDriveSyncManager.syncAll();
      // Start background sync for real-time cross-device updates (every 1 second for instant restore)
      googleDriveSyncManager.startBackgroundSync(1000);
    } else {
      googleDriveSyncManager.setAccessToken(null);
      googleDriveSyncManager.stopBackgroundSync();
    }
  });

  // Sync when app comes to foreground (visibility change)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('[Sync] App came to foreground, triggering sync');
      googleDriveSyncManager.syncAll();
    }
  });

  // Sync when app resumes (for native apps)
  window.addEventListener('resume', () => {
    console.log('[Sync] App resumed, triggering sync');
    googleDriveSyncManager.syncAll();
  });

  // Sync when online status changes
  window.addEventListener('online', () => {
    console.log('[Sync] Network online, triggering sync');
    googleDriveSyncManager.syncAll();
  });
}
