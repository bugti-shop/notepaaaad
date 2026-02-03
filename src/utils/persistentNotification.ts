import { LocalNotifications, LocalNotificationSchema } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { getSetting, setSetting } from './settingsStorage';
import { getVisibleNoteTypes } from './noteTypeVisibility';
import { NoteType } from '@/types/note';

// Persistent notification IDs
const PERSISTENT_NOTIFICATION_ID = 888888;
const PERSISTENT_ACTION_TYPE_ID = 'PERSISTENT_QUICK_ADD';

// Storage keys
const STORAGE_KEYS = {
  ENABLED: 'persistent_notification_enabled',
};

// Note type short labels for notification actions (no emojis, clean text)
const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  regular: 'Note',
  lined: 'Lined',
  sticky: 'Sticky',
  code: 'Code',
  sketch: 'Sketch',
  voice: 'Voice',
};

export interface PersistentNotificationManager {
  initialize: () => Promise<void>;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  isEnabled: () => Promise<boolean>;
  handleAction: (actionId: string) => void;
  refresh: () => Promise<void>;
}

class PersistentNotificationService implements PersistentNotificationManager {
  private static instance: PersistentNotificationService;
  private actionListeners: ((actionId: string) => void)[] = [];
  private cachedVisibleTypes: NoteType[] = [];

  private constructor() {}

  static getInstance(): PersistentNotificationService {
    if (!PersistentNotificationService.instance) {
      PersistentNotificationService.instance = new PersistentNotificationService();
    }
    return PersistentNotificationService.instance;
  }

  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('[PersistentNotification] Not on native platform, skipping');
      return;
    }

    try {
      // Setup action listener
      await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        if (action.notification.id === PERSISTENT_NOTIFICATION_ID) {
          const actionId = action.actionId;
          console.log('[PersistentNotification] Action performed:', actionId);
          
          // Store action in sessionStorage for fast launch (skip splash screen)
          sessionStorage.setItem('pendingNotificationAction', actionId);
          
          // Dispatch custom event for the app to handle
          window.dispatchEvent(new CustomEvent('persistentNotificationAction', {
            detail: { actionId }
          }));
          
          // Call registered listeners
          this.actionListeners.forEach(listener => listener(actionId));
          
          // Re-show the persistent notification after action (since it was dismissed)
          this.showPersistentNotification();
        }
      });

      // Listen for visibility changes to refresh notification
      window.addEventListener('noteTypesVisibilityChanged', () => {
        this.refresh();
      });

      // Check if should be enabled and restore
      const enabled = await this.isEnabled();
      if (enabled) {
        await this.showPersistentNotification();
      }

      console.log('[PersistentNotification] Initialized successfully');
    } catch (error) {
      console.error('[PersistentNotification] Initialization error:', error);
    }
  }

  async isEnabled(): Promise<boolean> {
    return await getSetting<boolean>(STORAGE_KEYS.ENABLED, false);
  }

  async enable(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('[PersistentNotification] Not on native platform');
      return;
    }

    try {
      await setSetting(STORAGE_KEYS.ENABLED, true);
      await this.showPersistentNotification();
      console.log('[PersistentNotification] Enabled');
    } catch (error) {
      console.error('[PersistentNotification] Error enabling:', error);
      throw error;
    }
  }

  async disable(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      await setSetting(STORAGE_KEYS.ENABLED, false);
      await this.hidePersistentNotification();
      console.log('[PersistentNotification] Disabled');
    } catch (error) {
      console.error('[PersistentNotification] Error disabling:', error);
    }
  }

  async refresh(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    
    const enabled = await this.isEnabled();
    if (enabled) {
      await this.showPersistentNotification();
    }
  }

  private async showPersistentNotification(): Promise<void> {
    try {
      // Cancel existing first to avoid duplicates
      await this.hidePersistentNotification();

      // Get all note types (include all types for notification)
      const allNoteTypes: NoteType[] = ['sticky', 'regular', 'lined', 'code', 'sketch'];
      this.cachedVisibleTypes = allNoteTypes;

      // Build actions dynamically - all note types + task
      const noteActions = allNoteTypes.map(type => ({
        id: `add_note_${type}`,
        title: NOTE_TYPE_LABELS[type],
      }));

      // Add the task action at the end
      const actions = [
        ...noteActions,
        { id: 'add_task', title: 'Task' },
      ];

      // Register action types with dynamic actions
      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: PERSISTENT_ACTION_TYPE_ID,
            actions: actions,
          },
        ],
      });

      const notification: LocalNotificationSchema = {
        id: PERSISTENT_NOTIFICATION_ID,
        title: 'Npd Quick Add',
        body: 'Tap to add notes or tasks quickly',
        actionTypeId: PERSISTENT_ACTION_TYPE_ID,
        ongoing: true, // Makes it persistent (can't be swiped away)
        autoCancel: false, // Stays after tap
        smallIcon: 'npd_notification_icon',
        largeIcon: 'npd_notification_icon',
        extra: {
          type: 'persistent_quick_add',
          isPersistent: true,
        },
      };

      await LocalNotifications.schedule({
        notifications: [notification],
      });

      console.log('[PersistentNotification] Shown with actions:', actions.map(a => a.id));
    } catch (error) {
      console.error('[PersistentNotification] Error showing:', error);
    }
  }

  private async hidePersistentNotification(): Promise<void> {
    try {
      await LocalNotifications.cancel({
        notifications: [{ id: PERSISTENT_NOTIFICATION_ID }],
      });
    } catch (error) {
      console.error('[PersistentNotification] Error hiding:', error);
    }
  }

  handleAction(actionId: string): void {
    // Dispatch event for the app to handle
    window.dispatchEvent(new CustomEvent('persistentNotificationAction', {
      detail: { actionId }
    }));
  }

  onAction(listener: (actionId: string) => void): () => void {
    this.actionListeners.push(listener);
    return () => {
      this.actionListeners = this.actionListeners.filter(l => l !== listener);
    };
  }
}

export const persistentNotificationManager = PersistentNotificationService.getInstance();
