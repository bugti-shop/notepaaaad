// Gamification Notification Scheduler
// Handles push notifications for streaks, challenges, and achievements

import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { getSetting, setSetting } from './settingsStorage';
import { loadStreakData, TASK_STREAK_KEY, isCompletedToday, getGracePeriodRemaining } from './streakStorage';
import { loadDailyChallenges } from './gamificationStorage';

const STREAK_REMINDER_ID = 900001;
const CHALLENGE_REMINDER_ID = 900002;
const GRACE_PERIOD_WARNING_ID = 900003;

export interface GamificationNotificationSettings {
  streakReminders: boolean;
  challengeReminders: boolean;
  gracePeriodAlerts: boolean;
  reminderTime: string; // HH:mm format, default "20:00"
}

const DEFAULT_SETTINGS: GamificationNotificationSettings = {
  streakReminders: true,
  challengeReminders: true,
  gracePeriodAlerts: true,
  reminderTime: '20:00',
};

export const loadGamificationNotificationSettings = async (): Promise<GamificationNotificationSettings> => {
  return getSetting<GamificationNotificationSettings>('gamificationNotifications', DEFAULT_SETTINGS);
};

export const saveGamificationNotificationSettings = async (settings: GamificationNotificationSettings): Promise<void> => {
  await setSetting('gamificationNotifications', settings);
  // Reschedule notifications with new settings
  await scheduleGamificationNotifications();
};

/**
 * Schedule all gamification-related notifications
 */
export const scheduleGamificationNotifications = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) {
    console.log('Gamification notifications only available on native platforms');
    return;
  }

  try {
    const settings = await loadGamificationNotificationSettings();
    
    // Cancel existing gamification notifications
    await cancelGamificationNotifications();
    
    if (settings.streakReminders) {
      await scheduleStreakReminder(settings.reminderTime);
    }
    
    if (settings.challengeReminders) {
      await scheduleChallengeReminder(settings.reminderTime);
    }
    
    console.log('Gamification notifications scheduled');
  } catch (error) {
    console.error('Failed to schedule gamification notifications:', error);
  }
};

/**
 * Cancel all gamification notifications
 */
export const cancelGamificationNotifications = async (): Promise<void> => {
  try {
    await LocalNotifications.cancel({
      notifications: [
        { id: STREAK_REMINDER_ID },
        { id: CHALLENGE_REMINDER_ID },
        { id: GRACE_PERIOD_WARNING_ID },
      ],
    });
  } catch (error) {
    console.error('Failed to cancel gamification notifications:', error);
  }
};

/**
 * Schedule daily streak reminder
 */
const scheduleStreakReminder = async (time: string): Promise<void> => {
  const streakData = await loadStreakData(TASK_STREAK_KEY);
  
  // Don't remind if already completed today
  if (isCompletedToday(streakData)) {
    return;
  }
  
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  const reminderTime = new Date();
  reminderTime.setHours(hours, minutes, 0, 0);
  
  // If time has passed, schedule for tomorrow
  if (reminderTime <= now) {
    reminderTime.setDate(reminderTime.getDate() + 1);
  }
  
  const streakMessage = streakData.currentStreak > 0
    ? `Your ${streakData.currentStreak}-day streak is at risk! Complete a task to keep it going. 🔥`
    : "Start a new streak today! Complete one task to begin. 💪";
  
  await LocalNotifications.schedule({
    notifications: [
      {
        id: STREAK_REMINDER_ID,
        title: '🔥 Streak Reminder',
        body: streakMessage,
        schedule: { at: reminderTime },
        smallIcon: 'npd_notification_icon',
        extra: {
          type: 'streak_reminder',
        },
      },
    ],
  });
};

/**
 * Schedule daily challenge reminder
 */
const scheduleChallengeReminder = async (time: string): Promise<void> => {
  const challengeData = await loadDailyChallenges();
  const incompleteChallenges = challengeData.challenges.filter(c => !c.completed);
  
  // Don't remind if all challenges are complete
  if (incompleteChallenges.length === 0) {
    return;
  }
  
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  const reminderTime = new Date();
  // Schedule challenge reminder 1 hour after streak reminder
  reminderTime.setHours(hours + 1, minutes, 0, 0);
  
  // If time has passed, schedule for tomorrow
  if (reminderTime <= now) {
    reminderTime.setDate(reminderTime.getDate() + 1);
  }
  
  await LocalNotifications.schedule({
    notifications: [
      {
        id: CHALLENGE_REMINDER_ID,
        title: '🎯 Daily Challenges',
        body: `You have ${incompleteChallenges.length} challenge${incompleteChallenges.length > 1 ? 's' : ''} left today. Complete them for bonus XP! ⭐`,
        schedule: { at: reminderTime },
        smallIcon: 'npd_notification_icon',
        extra: {
          type: 'challenge_reminder',
        },
      },
    ],
  });
};

/**
 * Schedule grace period warning (call when user is in grace period)
 */
export const scheduleGracePeriodWarning = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  
  const settings = await loadGamificationNotificationSettings();
  if (!settings.gracePeriodAlerts) return;
  
  const streakData = await loadStreakData(TASK_STREAK_KEY);
  const remaining = getGracePeriodRemaining(streakData);
  
  if (remaining <= 0 || remaining > 6) return;
  
  // Schedule warning 2 hours before grace period ends
  const warningTime = new Date();
  warningTime.setHours(warningTime.getHours() + Math.max(1, remaining - 2));
  
  await LocalNotifications.schedule({
    notifications: [
      {
        id: GRACE_PERIOD_WARNING_ID,
        title: '⚠️ Streak Ending Soon!',
        body: `Only ${remaining} hours left to save your ${streakData.currentStreak}-day streak! Complete a task now! 🔥`,
        schedule: { at: warningTime },
        smallIcon: 'npd_notification_icon',
        extra: {
          type: 'grace_period_warning',
        },
      },
    ],
  });
};

/**
 * Show instant notification for achievement unlock
 */
export const showAchievementNotification = async (achievementName: string, xpReward: number): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  
  await LocalNotifications.schedule({
    notifications: [
      {
        id: Math.floor(Math.random() * 100000) + 900100,
        title: '🏆 Achievement Unlocked!',
        body: `${achievementName} - You earned ${xpReward} XP!`,
        schedule: { at: new Date(Date.now() + 100) }, // Immediate
        smallIcon: 'npd_notification_icon',
        extra: {
          type: 'achievement',
        },
      },
    ],
  });
};

/**
 * Show instant notification for level up
 */
export const showLevelUpNotification = async (newLevel: number, title: string): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  
  await LocalNotifications.schedule({
    notifications: [
      {
        id: Math.floor(Math.random() * 100000) + 900200,
        title: '🎉 Level Up!',
        body: `Congratulations! You reached Level ${newLevel} - ${title}!`,
        schedule: { at: new Date(Date.now() + 100) }, // Immediate
        smallIcon: 'npd_notification_icon',
        extra: {
          type: 'level_up',
        },
      },
    ],
  });
};

/**
 * Initialize gamification notifications on app start
 */
export const initializeGamificationNotifications = async (): Promise<void> => {
  await scheduleGamificationNotifications();
};
