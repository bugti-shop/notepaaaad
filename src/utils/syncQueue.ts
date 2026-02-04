import { Note, NoteConflictCopy, SyncStatus } from '@/types/note';
import { getSetting, setSetting } from '@/utils/settingsStorage';
import { getDeviceId } from '@/utils/noteDefaults';

// Sync queue item
export interface SyncQueueItem {
  id: string;
  noteId: string;
  action: 'create' | 'update' | 'delete';
  timestamp: Date;
  retryCount: number;
  lastError?: string;
  status: 'pending' | 'processing' | 'failed' | 'completed';
}

// Sync state for the entire app
export interface SyncState {
  status: 'idle' | 'syncing' | 'error' | 'offline';
  lastSyncedAt?: Date;
  pendingCount: number;
  errorCount: number;
  lastError?: string;
}

const QUEUE_STORAGE_KEY = 'sync_queue';
const CONFLICT_STORAGE_KEY = 'note_conflicts';
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1000;

// Exponential backoff calculator
export const calculateBackoff = (retryCount: number): number => {
  return Math.min(BASE_BACKOFF_MS * Math.pow(2, retryCount), 60000); // Max 1 minute
};

// Load sync queue from storage
export const loadSyncQueue = async (): Promise<SyncQueueItem[]> => {
  const queue = await getSetting<SyncQueueItem[]>(QUEUE_STORAGE_KEY, []);
  return queue.map(item => ({
    ...item,
    timestamp: new Date(item.timestamp),
  }));
};

// Save sync queue to storage
export const saveSyncQueue = async (queue: SyncQueueItem[]): Promise<void> => {
  await setSetting(QUEUE_STORAGE_KEY, queue);
};

// Add item to sync queue (idempotent - won't duplicate)
export const addToSyncQueue = async (
  noteId: string,
  action: 'create' | 'update' | 'delete'
): Promise<void> => {
  const queue = await loadSyncQueue();
  
  // Remove existing entry for this note to avoid duplicates
  const filtered = queue.filter(item => item.noteId !== noteId);
  
  // Add new entry
  const newItem: SyncQueueItem = {
    id: `${noteId}_${Date.now()}`,
    noteId,
    action,
    timestamp: new Date(),
    retryCount: 0,
    status: 'pending',
  };
  
  filtered.push(newItem);
  await saveSyncQueue(filtered);
  
  console.log(`[SyncQueue] Added ${action} for note ${noteId}`);
};

// Remove item from sync queue after successful sync
export const removeFromSyncQueue = async (noteId: string): Promise<void> => {
  const queue = await loadSyncQueue();
  const filtered = queue.filter(item => item.noteId !== noteId);
  await saveSyncQueue(filtered);
};

// Mark item as failed and increment retry count
export const markSyncFailed = async (
  noteId: string,
  error: string
): Promise<void> => {
  const queue = await loadSyncQueue();
  const updated = queue.map(item => {
    if (item.noteId === noteId) {
      return {
        ...item,
        status: 'failed' as const,
        retryCount: item.retryCount + 1,
        lastError: error,
      };
    }
    return item;
  });
  await saveSyncQueue(updated);
};

// Get pending items ready for retry
export const getPendingItems = async (): Promise<SyncQueueItem[]> => {
  const queue = await loadSyncQueue();
  const now = Date.now();
  
  return queue.filter(item => {
    if (item.status === 'completed') return false;
    if (item.retryCount >= MAX_RETRIES) return false;
    
    // Check if enough time has passed for retry (exponential backoff)
    const backoffTime = calculateBackoff(item.retryCount);
    const timeSinceLastAttempt = now - new Date(item.timestamp).getTime();
    
    return timeSinceLastAttempt >= backoffTime;
  });
};

// Get current sync state
export const getSyncState = async (): Promise<SyncState> => {
  const queue = await loadSyncQueue();
  const lastSyncedAt = await getSetting<string>('last_full_sync', '');
  
  const pendingCount = queue.filter(i => i.status === 'pending' || i.status === 'failed').length;
  const errorCount = queue.filter(i => i.retryCount >= MAX_RETRIES).length;
  
  let status: SyncState['status'] = 'idle';
  if (!navigator.onLine) {
    status = 'offline';
  } else if (errorCount > 0) {
    status = 'error';
  } else if (pendingCount > 0) {
    status = 'syncing';
  }
  
  return {
    status,
    lastSyncedAt: lastSyncedAt ? new Date(lastSyncedAt) : undefined,
    pendingCount,
    errorCount,
    lastError: queue.find(i => i.lastError)?.lastError,
  };
};

// Clear completed and max-retried items from queue
export const cleanupSyncQueue = async (): Promise<void> => {
  const queue = await loadSyncQueue();
  const cleaned = queue.filter(item => 
    item.status !== 'completed' && item.retryCount < MAX_RETRIES
  );
  await saveSyncQueue(cleaned);
};

// ============= CONFLICT MANAGEMENT =============

// Load conflict copies from storage
export const loadConflictCopies = async (): Promise<NoteConflictCopy[]> => {
  const conflicts = await getSetting<NoteConflictCopy[]>(CONFLICT_STORAGE_KEY, []);
  return conflicts.map(c => ({
    ...c,
    timestamp: new Date(c.timestamp),
  }));
};

// Save conflict copies to storage
export const saveConflictCopies = async (conflicts: NoteConflictCopy[]): Promise<void> => {
  await setSetting(CONFLICT_STORAGE_KEY, conflicts);
};

// Create a conflict copy when versions diverge
export const createConflictCopy = async (
  localNote: Note,
  remoteNote: Note
): Promise<NoteConflictCopy> => {
  const conflicts = await loadConflictCopies();
  
  // Determine which version to store as conflict (the one not being used)
  // We'll store the remote version as conflict and use local as primary
  const conflictCopy: NoteConflictCopy = {
    id: `conflict_${localNote.id}_${Date.now()}`,
    noteId: localNote.id,
    content: remoteNote.content,
    title: remoteNote.title,
    version: remoteNote.syncVersion,
    deviceId: remoteNote.deviceId || 'unknown',
    timestamp: new Date(),
    resolved: false,
  };
  
  conflicts.push(conflictCopy);
  await saveConflictCopies(conflicts);
  
  console.log(`[Conflict] Created conflict copy for note ${localNote.id}`);
  return conflictCopy;
};

// Get conflict copies for a specific note
export const getConflictCopiesForNote = async (noteId: string): Promise<NoteConflictCopy[]> => {
  const conflicts = await loadConflictCopies();
  return conflicts.filter(c => c.noteId === noteId && !c.resolved);
};

// Resolve a conflict (mark as resolved)
export const resolveConflict = async (conflictId: string): Promise<void> => {
  const conflicts = await loadConflictCopies();
  const updated = conflicts.map(c => 
    c.id === conflictId ? { ...c, resolved: true } : c
  );
  await saveConflictCopies(updated);
};

// Delete resolved conflicts older than 7 days
export const cleanupResolvedConflicts = async (): Promise<void> => {
  const conflicts = await loadConflictCopies();
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  
  const cleaned = conflicts.filter(c => 
    !c.resolved || new Date(c.timestamp).getTime() > sevenDaysAgo
  );
  await saveConflictCopies(cleaned);
};

// ============= CONFLICT DETECTION =============

// Compare two notes and detect if there's a conflict
export const detectConflict = (
  localNote: Note,
  remoteNote: Note
): { hasConflict: boolean; winner: 'local' | 'remote' | 'conflict' } => {
  // If versions are same, no conflict
  if (localNote.syncVersion === remoteNote.syncVersion) {
    return { hasConflict: false, winner: 'local' };
  }
  
  // If local is newer (higher version), local wins
  if (localNote.syncVersion > remoteNote.syncVersion) {
    return { hasConflict: false, winner: 'local' };
  }
  
  // If remote is newer but local has changes (isDirty), it's a conflict
  if (localNote.isDirty && remoteNote.syncVersion > localNote.syncVersion) {
    return { hasConflict: true, winner: 'conflict' };
  }
  
  // Remote is newer and local is clean, remote wins
  return { hasConflict: false, winner: 'remote' };
};

// Merge notes with conflict detection
export const mergeNotesWithConflictDetection = async (
  localNotes: Note[],
  remoteNotes: Note[]
): Promise<{ merged: Note[]; conflicts: NoteConflictCopy[] }> => {
  const merged = new Map<string, Note>();
  const newConflicts: NoteConflictCopy[] = [];
  const deviceId = await getDeviceId();
  
  // First, add all remote notes
  for (const remoteNote of remoteNotes) {
    merged.set(remoteNote.id, {
      ...remoteNote,
      createdAt: new Date(remoteNote.createdAt),
      updatedAt: new Date(remoteNote.updatedAt),
      lastSyncedAt: remoteNote.lastSyncedAt ? new Date(remoteNote.lastSyncedAt) : undefined,
      voiceRecordings: remoteNote.voiceRecordings?.map((r: any) => ({
        ...r,
        timestamp: new Date(r.timestamp),
      })) || [],
    });
  }
  
  // Then process local notes
  for (const localNote of localNotes) {
    const remoteNote = merged.get(localNote.id);
    
    if (!remoteNote) {
      // Note only exists locally - add it
      merged.set(localNote.id, localNote);
      continue;
    }
    
    // Detect conflict
    const { hasConflict, winner } = detectConflict(localNote, remoteNote);
    
    if (hasConflict) {
      // Create conflict copy of remote version
      const conflictCopy = await createConflictCopy(localNote, remoteNote);
      newConflicts.push(conflictCopy);
      
      // Use local version but mark as having conflict
      merged.set(localNote.id, {
        ...localNote,
        hasConflict: true,
        conflictCopyId: conflictCopy.id,
        syncStatus: 'conflict' as SyncStatus,
      });
    } else if (winner === 'local') {
      merged.set(localNote.id, localNote);
    }
    // If winner is 'remote', the remote note is already in merged
  }
  
  return {
    merged: Array.from(merged.values()),
    conflicts: newConflicts,
  };
};

// ============= SYNC CURSOR / TOKEN =============

// Get last sync cursor for incremental sync
export const getLastSyncCursor = async (): Promise<string | null> => {
  return await getSetting<string | null>('sync_cursor', null);
};

// Set sync cursor after successful sync
export const setLastSyncCursor = async (cursor: string): Promise<void> => {
  await setSetting('sync_cursor', cursor);
};

// Get notes modified since last sync
export const getModifiedNotesSince = (
  notes: Note[],
  lastSyncTime: Date | null
): Note[] => {
  if (!lastSyncTime) return notes;
  
  return notes.filter(note => 
    note.isDirty || 
    new Date(note.updatedAt).getTime() > lastSyncTime.getTime()
  );
};
