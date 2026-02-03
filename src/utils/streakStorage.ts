// Modular streak storage utility
// Works with IndexedDB via settingsStorage for offline persistence
// Can be reused for habits, notes, routines etc.

import { getSetting, setSetting } from './settingsStorage';
import { startOfDay, differenceInDays, format, subDays } from 'date-fns';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastCompletionDate: string | null; // ISO date string (YYYY-MM-DD)
  streakFreezes: number;
  totalCompletions: number;
  milestones: number[]; // Milestones achieved (3, 7, 14, 30, etc.)
  weekHistory: Record<string, boolean>; // Last 7 days completion status
}

export interface StreakConfig {
  storageKey: string;
  milestoneValues: number[];
}

const DEFAULT_MILESTONES = [3, 7, 14, 30, 60, 100, 365];

const getDefaultStreakData = (): StreakData => ({
  currentStreak: 0,
  longestStreak: 0,
  lastCompletionDate: null,
  streakFreezes: 0,
  totalCompletions: 0,
  milestones: [],
  weekHistory: {},
});

// Get today's date string in local time (YYYY-MM-DD)
export const getTodayDateString = (): string => {
  return format(new Date(), 'yyyy-MM-dd');
};

// Get date string for a specific date
export const getDateString = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

// Load streak data from storage
export const loadStreakData = async (storageKey: string): Promise<StreakData> => {
  const data = await getSetting<StreakData>(storageKey, getDefaultStreakData());
  return data;
};

// Save streak data to storage
export const saveStreakData = async (storageKey: string, data: StreakData): Promise<void> => {
  await setSetting(storageKey, data);
};

// Check if streak was completed today
export const isCompletedToday = (data: StreakData): boolean => {
  if (!data.lastCompletionDate) return false;
  return data.lastCompletionDate === getTodayDateString();
};

// Check if streak is at risk (day about to end without completion)
export const isStreakAtRisk = (data: StreakData): boolean => {
  if (isCompletedToday(data)) return false;
  if (data.currentStreak === 0) return false;
  
  const now = new Date();
  const hours = now.getHours();
  // Show warning after 8 PM (20:00)
  return hours >= 20;
};

// Check if streak was lost (missed a day)
export const checkStreakStatus = (data: StreakData): 'active' | 'at_risk' | 'lost' | 'new' => {
  const today = getTodayDateString();
  const yesterday = getDateString(subDays(new Date(), 1));
  
  if (!data.lastCompletionDate) {
    return 'new';
  }
  
  if (data.lastCompletionDate === today) {
    return 'active';
  }
  
  if (data.lastCompletionDate === yesterday) {
    return isStreakAtRisk(data) ? 'at_risk' : 'active';
  }
  
  // Missed more than one day
  return 'lost';
};

// Record a completion (call when user completes a task)
export const recordCompletion = async (
  storageKey: string,
  milestones: number[] = DEFAULT_MILESTONES
): Promise<{ 
  data: StreakData; 
  streakIncremented: boolean; 
  newMilestone: number | null;
  usedFreeze: boolean;
}> => {
  const data = await loadStreakData(storageKey);
  const today = getTodayDateString();
  const yesterday = getDateString(subDays(new Date(), 1));
  
  let streakIncremented = false;
  let newMilestone: number | null = null;
  let usedFreeze = false;
  
  // Already completed today - no changes needed
  if (data.lastCompletionDate === today) {
    return { data, streakIncremented: false, newMilestone: null, usedFreeze: false };
  }
  
  // Update total completions
  data.totalCompletions += 1;
  
  // Check if this extends the streak or starts a new one
  if (data.lastCompletionDate === yesterday) {
    // Continuing streak from yesterday
    data.currentStreak += 1;
    streakIncremented = true;
  } else if (data.lastCompletionDate === null) {
    // First ever completion
    data.currentStreak = 1;
    streakIncremented = true;
  } else {
    // Missed a day - check for streak freeze
    const daysMissed = differenceInDays(
      startOfDay(new Date()),
      startOfDay(new Date(data.lastCompletionDate))
    );
    
    if (daysMissed === 2 && data.streakFreezes > 0) {
      // Can use a freeze (missed exactly one day)
      data.streakFreezes -= 1;
      data.currentStreak += 1;
      usedFreeze = true;
      streakIncremented = true;
    } else {
      // Streak is broken - start fresh
      data.currentStreak = 1;
      streakIncremented = true;
    }
  }
  
  // Update longest streak
  if (data.currentStreak > data.longestStreak) {
    data.longestStreak = data.currentStreak;
  }
  
  // Check for new milestones
  for (const milestone of milestones) {
    if (data.currentStreak === milestone && !data.milestones.includes(milestone)) {
      data.milestones.push(milestone);
      newMilestone = milestone;
      break; // Only one milestone at a time
    }
  }
  
  // Update last completion date
  data.lastCompletionDate = today;
  
  // Update week history
  data.weekHistory[today] = true;
  
  // Clean up old week history (keep only last 14 days)
  const twoWeeksAgo = getDateString(subDays(new Date(), 14));
  const cleanedHistory: Record<string, boolean> = {};
  for (const [date, completed] of Object.entries(data.weekHistory)) {
    if (date >= twoWeeksAgo) {
      cleanedHistory[date] = completed;
    }
  }
  data.weekHistory = cleanedHistory;
  
  // Save updated data
  await saveStreakData(storageKey, data);
  
  return { data, streakIncremented, newMilestone, usedFreeze };
};

// Add streak freezes (can be earned or purchased)
export const addStreakFreeze = async (storageKey: string, count: number = 1): Promise<StreakData> => {
  const data = await loadStreakData(storageKey);
  data.streakFreezes += count;
  await saveStreakData(storageKey, data);
  return data;
};

// Reset streak (manual reset)
export const resetStreak = async (storageKey: string): Promise<StreakData> => {
  const data = await loadStreakData(storageKey);
  data.currentStreak = 0;
  data.lastCompletionDate = null;
  await saveStreakData(storageKey, data);
  return data;
};

// Get week data for display (last 7 days)
export const getWeekData = (data: StreakData): Array<{ day: string; date: string; completed: boolean; isToday: boolean }> => {
  const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const today = new Date();
  const todayString = getTodayDateString();
  
  const result: Array<{ day: string; date: string; completed: boolean; isToday: boolean }> = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = subDays(today, i);
    const dateString = getDateString(date);
    const dayIndex = date.getDay();
    
    result.push({
      day: days[dayIndex],
      date: dateString,
      completed: data.weekHistory[dateString] || false,
      isToday: dateString === todayString,
    });
  }
  
  return result;
};

// Check and update streak on app open (handles missed days)
export const checkAndUpdateStreak = async (storageKey: string): Promise<StreakData> => {
  const data = await loadStreakData(storageKey);
  const status = checkStreakStatus(data);
  
  if (status === 'lost' && data.currentStreak > 0) {
    // Check if we can use a freeze
    const daysMissed = data.lastCompletionDate
      ? differenceInDays(startOfDay(new Date()), startOfDay(new Date(data.lastCompletionDate)))
      : 0;
    
    if (daysMissed === 2 && data.streakFreezes > 0) {
      // Auto-consume freeze for yesterday
      data.streakFreezes -= 1;
      const yesterday = getDateString(subDays(new Date(), 1));
      data.weekHistory[yesterday] = true; // Mark as "saved"
      await saveStreakData(storageKey, data);
    } else {
      // Streak is lost
      data.currentStreak = 0;
      await saveStreakData(storageKey, data);
    }
  }
  
  return data;
};

// Storage key constants
export const TASK_STREAK_KEY = 'npd_task_streak';
export const NOTES_STREAK_KEY = 'npd_notes_streak';
export const HABITS_STREAK_KEY = 'npd_habits_streak';
