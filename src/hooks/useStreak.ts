// Custom hook for streak management
// Provides reactive streak data and actions

import { useState, useEffect, useCallback } from 'react';
import {
  StreakData,
  loadStreakData,
  recordCompletion,
  checkAndUpdateStreak,
  isCompletedToday,
  isStreakAtRisk,
  checkStreakStatus,
  getWeekData,
  addStreakFreeze,
  TASK_STREAK_KEY,
} from '@/utils/streakStorage';
import { triggerNotificationHaptic, triggerHaptic } from '@/utils/haptics';

interface UseStreakOptions {
  storageKey?: string;
  autoCheck?: boolean;
}

interface UseStreakReturn {
  data: StreakData | null;
  isLoading: boolean;
  completedToday: boolean;
  atRisk: boolean;
  status: 'active' | 'at_risk' | 'lost' | 'new';
  weekData: Array<{ day: string; date: string; completed: boolean; isToday: boolean }>;
  recordTaskCompletion: () => Promise<{ newMilestone: number | null; usedFreeze: boolean }>;
  addFreeze: (count?: number) => Promise<void>;
  refresh: () => Promise<void>;
}

export const useStreak = (options: UseStreakOptions = {}): UseStreakReturn => {
  const { storageKey = TASK_STREAK_KEY, autoCheck = true } = options;
  
  const [data, setData] = useState<StreakData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load and check streak on mount
  const loadStreak = useCallback(async () => {
    try {
      const streakData = autoCheck 
        ? await checkAndUpdateStreak(storageKey)
        : await loadStreakData(storageKey);
      setData(streakData);
    } catch (error) {
      console.error('Failed to load streak:', error);
    } finally {
      setIsLoading(false);
    }
  }, [storageKey, autoCheck]);

  useEffect(() => {
    loadStreak();
  }, [loadStreak]);

  // Listen for streak updates from other components
  useEffect(() => {
    const handleStreakUpdate = () => {
      loadStreak();
    };
    
    window.addEventListener('streakUpdated', handleStreakUpdate);
    return () => window.removeEventListener('streakUpdated', handleStreakUpdate);
  }, [loadStreak]);

  // Record a task completion
  const recordTaskCompletion = useCallback(async (): Promise<{ newMilestone: number | null; usedFreeze: boolean }> => {
    const result = await recordCompletion(storageKey);
    setData(result.data);
    
    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('streakUpdated'));
    
    // Haptic feedback for milestone
    if (result.newMilestone) {
      triggerNotificationHaptic('success');
    } else if (result.streakIncremented) {
      triggerHaptic('light');
    }
    
    return { newMilestone: result.newMilestone, usedFreeze: result.usedFreeze };
  }, [storageKey]);

  // Add streak freeze
  const addFreeze = useCallback(async (count: number = 1) => {
    const updatedData = await addStreakFreeze(storageKey, count);
    setData(updatedData);
    window.dispatchEvent(new CustomEvent('streakUpdated'));
  }, [storageKey]);

  // Refresh data
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await loadStreak();
  }, [loadStreak]);

  // Computed values
  const completedToday = data ? isCompletedToday(data) : false;
  const atRisk = data ? isStreakAtRisk(data) : false;
  const status = data ? checkStreakStatus(data) : 'new';
  const weekData = data ? getWeekData(data) : [];

  return {
    data,
    isLoading,
    completedToday,
    atRisk,
    status,
    weekData,
    recordTaskCompletion,
    addFreeze,
    refresh,
  };
};
