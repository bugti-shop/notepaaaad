import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useGoogleAuth } from '@/contexts/GoogleAuthContext';
import { googleDriveSyncManager } from '@/utils/googleDriveSync';
import { toast } from 'sonner';

interface SmartSyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  lastSync: Date | null;
  hasError: boolean;
  triggerSync: () => Promise<boolean>;
  syncNow: (dataType?: 'notes' | 'tasks' | 'folders' | 'sections' | 'settings' | 'activity' | 'media' | 'all') => Promise<boolean>;
}

const SmartSyncContext = createContext<SmartSyncContextType | undefined>(undefined);

export const SmartSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isSignedIn, refreshToken } = useGoogleAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [hasError, setHasError] = useState(false);
  const syncLock = useRef(false);

  // Perform sync immediately with no delays
  const performSync = useCallback(async (reason: string): Promise<boolean> => {
    if (!isSignedIn || !user?.authentication?.accessToken) {
      return false;
    }

    // Use lock to prevent concurrent syncs
    if (syncLock.current) {
      console.log(`[InstantSync] Sync already in progress, skipping (${reason})`);
      return false;
    }

    syncLock.current = true;
    
    try {
      setIsSyncing(true);
      setHasError(false);
      console.log(`[InstantSync] Syncing immediately (${reason})...`);

      // Set the token and refresh function
      googleDriveSyncManager.setAccessToken(user.authentication.accessToken);
      googleDriveSyncManager.setRefreshTokenFn(refreshToken);
      
      const result = await googleDriveSyncManager.syncAll();

      if (result.success) {
        setLastSync(new Date());
        console.log(`[InstantSync] Sync complete (${reason})`);
        window.dispatchEvent(new CustomEvent('syncComplete'));
        return true;
      } else {
        console.warn(`[InstantSync] Sync had errors:`, result.errors);
        setHasError(true);
        return false;
      }
    } catch (error) {
      console.error(`[InstantSync] Sync failed:`, error);
      setHasError(true);
      return false;
    } finally {
      setIsSyncing(false);
      syncLock.current = false;
    }
  }, [isSignedIn, user, refreshToken]);

  // Sync specific data type immediately
  const syncNow = useCallback(async (dataType: 'notes' | 'tasks' | 'folders' | 'sections' | 'settings' | 'activity' | 'media' | 'all' = 'all'): Promise<boolean> => {
    if (!isSignedIn || !user?.authentication?.accessToken) {
      return false;
    }

    if (syncLock.current) {
      return false;
    }

    syncLock.current = true;
    
    try {
      setIsSyncing(true);
      googleDriveSyncManager.setAccessToken(user.authentication.accessToken);
      googleDriveSyncManager.setRefreshTokenFn(refreshToken);

      let success = false;
      
      switch (dataType) {
        case 'notes':
          success = await googleDriveSyncManager.syncNotes();
          break;
        case 'tasks':
          success = await googleDriveSyncManager.syncTasks();
          break;
        case 'folders':
          success = await googleDriveSyncManager.syncFolders();
          break;
        case 'sections':
          success = await googleDriveSyncManager.syncSections();
          break;
        case 'settings':
          success = await googleDriveSyncManager.syncSettings();
          break;
        case 'activity':
          success = await googleDriveSyncManager.syncActivity();
          break;
        case 'media':
          success = await googleDriveSyncManager.syncMedia();
          break;
        case 'all':
        default:
          const result = await googleDriveSyncManager.syncAll();
          success = result.success;
          break;
      }

      if (success) {
        setLastSync(new Date());
        window.dispatchEvent(new CustomEvent('syncComplete'));
      }
      
      return success;
    } catch (error) {
      console.error(`[InstantSync] Sync ${dataType} failed:`, error);
      setHasError(true);
      return false;
    } finally {
      setIsSyncing(false);
      syncLock.current = false;
    }
  }, [isSignedIn, user, refreshToken]);

  // Online/offline detection - sync immediately when back online
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (isSignedIn) {
        toast.success('Back online - syncing now...');
        performSync('network-restored');
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You are offline - changes will sync when reconnected');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [performSync, isSignedIn]);

  // Visibility sync - sync IMMEDIATELY when app regains focus (no delay)
  useEffect(() => {
    if (!isSignedIn) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        performSync('app-focus');
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isSignedIn, performSync]);

  // Initial sync when signed in - no delay
  useEffect(() => {
    if (!isSignedIn) return;
    performSync('initial');
  }, [isSignedIn, performSync]);

  // Listen for data changes and sync INSTANTLY
  useEffect(() => {
    if (!isSignedIn) return;

    const handleNotesUpdated = () => {
      console.log('[InstantSync] Notes updated - syncing immediately');
      syncNow('notes');
    };

    const handleTasksUpdated = () => {
      console.log('[InstantSync] Tasks updated - syncing immediately');
      syncNow('tasks');
    };

    const handleFoldersUpdated = () => {
      console.log('[InstantSync] Folders updated - syncing immediately');
      syncNow('folders');
    };

    const handleSectionsUpdated = () => {
      console.log('[InstantSync] Sections updated - syncing immediately');
      syncNow('sections');
    };

    const handleSettingsUpdated = () => {
      console.log('[InstantSync] Settings updated - syncing immediately');
      syncNow('settings');
    };

    const handleMediaUpdated = () => {
      console.log('[InstantSync] Media updated - syncing immediately');
      syncNow('media');
    };

    window.addEventListener('notesUpdated', handleNotesUpdated);
    window.addEventListener('tasksUpdated', handleTasksUpdated);
    window.addEventListener('foldersUpdated', handleFoldersUpdated);
    window.addEventListener('sectionsUpdated', handleSectionsUpdated);
    window.addEventListener('settingsUpdated', handleSettingsUpdated);
    window.addEventListener('mediaUpdated', handleMediaUpdated);

    return () => {
      window.removeEventListener('notesUpdated', handleNotesUpdated);
      window.removeEventListener('tasksUpdated', handleTasksUpdated);
      window.removeEventListener('foldersUpdated', handleFoldersUpdated);
      window.removeEventListener('sectionsUpdated', handleSectionsUpdated);
      window.removeEventListener('settingsUpdated', handleSettingsUpdated);
      window.removeEventListener('mediaUpdated', handleMediaUpdated);
    };
  }, [isSignedIn, syncNow]);

  // Load last sync time on mount
  useEffect(() => {
    const loadLastSync = async () => {
      const time = await googleDriveSyncManager.getLastSyncTime();
      if (time) setLastSync(time);
    };
    loadLastSync();
  }, []);

  const triggerSync = useCallback(() => performSync('manual'), [performSync]);

  return (
    <SmartSyncContext.Provider value={{ isOnline, isSyncing, lastSync, hasError, triggerSync, syncNow }}>
      {children}
    </SmartSyncContext.Provider>
  );
};

export const useSmartSync = (): SmartSyncContextType => {
  const context = useContext(SmartSyncContext);
  if (!context) {
    throw new Error('useSmartSync must be used within SmartSyncProvider');
  }
  return context;
};

// Optional hook for components outside provider
export const useSmartSyncOptional = (): SmartSyncContextType | null => {
  return useContext(SmartSyncContext) || null;
};
