import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TodoLayout } from './TodoLayout';
import { useStreak } from '@/hooks/useStreak';
import { cn } from '@/lib/utils';
import { Flame, Check, Snowflake, Trophy, Zap, TrendingUp, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { loadTodoItems } from '@/utils/todoItemsStorage';
import { isToday, isThisWeek, startOfWeek, endOfWeek, format } from 'date-fns';

const Progress = () => {
  const { t } = useTranslation();
  const { data, isLoading, completedToday, atRisk, status, weekData, refresh } = useStreak();
  const [showMilestoneAnimation, setShowMilestoneAnimation] = useState(false);
  const [weekStats, setWeekStats] = useState({ completed: 0, total: 0 });

  // Load weekly stats
  useEffect(() => {
    const loadWeekStats = async () => {
      try {
        const tasks = await loadTodoItems();
        const now = new Date();
        const weekStart = startOfWeek(now, { weekStartsOn: 0 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
        
        const thisWeekTasks = tasks.filter(task => {
          if (!task.completedAt) return false;
          const completedDate = new Date(task.completedAt);
          return completedDate >= weekStart && completedDate <= weekEnd;
        });
        
        setWeekStats({
          completed: thisWeekTasks.length,
          total: tasks.filter(t => t.completed).length,
        });
      } catch (error) {
        console.error('Failed to load week stats:', error);
      }
    };
    
    loadWeekStats();
  }, []);

  // Get encouraging message based on status
  const getMessage = () => {
    if (completedToday) {
      if (data?.currentStreak === 1) {
        return t('streak.firstDayComplete', "Great start! Let's keep going tomorrow.");
      }
      return t('streak.continueMessage', "I knew you'd come back! Let's do this again tomorrow.");
    }
    
    if (status === 'lost' || status === 'new') {
      return t('streak.newStreakMessage', 'New streaks start today. Complete one task to begin!');
    }
    
    if (atRisk) {
      return t('streak.atRiskMessage', 'Complete one task today to keep your streak going!');
    }
    
    return t('streak.keepGoingMessage', 'You\'re on a roll! Keep it up.');
  };

  // Milestone badges
  const milestones = [
    { value: 3, icon: Zap, label: '3 days', color: 'text-yellow-500' },
    { value: 7, icon: Trophy, label: '1 week', color: 'text-blue-500' },
    { value: 14, icon: TrendingUp, label: '2 weeks', color: 'text-green-500' },
    { value: 30, icon: Flame, label: '1 month', color: 'text-orange-500' },
  ];

  if (isLoading) {
    return (
      <TodoLayout title={t('nav.progress', 'Progress')}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </TodoLayout>
    );
  }

  return (
    <TodoLayout title={t('nav.progress', 'Progress')}>
      <div className="container mx-auto px-4 py-6 space-y-6">
        
        {/* Streak Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-6 border shadow-sm"
        >
          {/* Message Bubble */}
          <div className="relative bg-muted rounded-xl p-4 mb-6">
            <p className="text-sm text-foreground">{getMessage()}</p>
            <div className="absolute -bottom-2 left-8 w-4 h-4 bg-muted rotate-45" />
          </div>
          
          {/* Flame Icon and Streak Count */}
          <div className="flex flex-col items-center py-6">
            <motion.div
              animate={{ 
                scale: completedToday ? [1, 1.1, 1] : 1,
              }}
              transition={{ duration: 0.5, repeat: completedToday ? 0 : undefined }}
              className="relative"
            >
              <Flame 
                className={cn(
                  "h-24 w-24 transition-colors",
                  completedToday ? "text-orange-500 fill-orange-400" : "text-muted-foreground/30"
                )} 
              />
              {data?.currentStreak !== undefined && data.currentStreak > 0 && (
                <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-white drop-shadow-md mt-2">
                  {data.currentStreak}
                </span>
              )}
            </motion.div>
            
            <motion.div 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="text-center mt-4"
            >
              <h2 className={cn(
                "text-5xl font-bold",
                completedToday ? "text-orange-500" : "text-muted-foreground"
              )}>
                {data?.currentStreak || 0}
              </h2>
              <p className={cn(
                "text-lg font-medium",
                completedToday ? "text-orange-500" : "text-muted-foreground"
              )}>
                {t('streak.dayStreak', 'day streak')}
              </p>
            </motion.div>
          </div>
          
          {/* Week Progress */}
          <div className="flex justify-between items-center gap-2 mt-6">
            {weekData.map((day, index) => (
              <div key={day.date} className="flex flex-col items-center gap-2">
                <span className={cn(
                  "text-xs font-medium",
                  day.isToday ? "text-primary" : "text-muted-foreground"
                )}>
                  {day.day}
                </span>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                    day.completed 
                      ? "bg-orange-500 border-orange-500 text-white" 
                      : day.isToday 
                        ? "border-primary bg-primary/10" 
                        : "border-muted bg-muted/50"
                  )}
                >
                  {day.completed && <Check className="h-5 w-5" />}
                </motion.div>
              </div>
            ))}
          </div>
          
          {/* Streak Freezes */}
          {data?.streakFreezes !== undefined && data.streakFreezes > 0 && (
            <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t">
              <Snowflake className="h-5 w-5 text-blue-400" />
              <span className="text-sm text-muted-foreground">
                {data.streakFreezes} {t('streak.freezesAvailable', 'streak freeze(s) available')}
              </span>
            </div>
          )}
        </motion.div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-xl p-4 border"
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Trophy className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">{t('streak.longestStreak', 'Longest Streak')}</span>
            </div>
            <p className="text-2xl font-bold">{data?.longestStreak || 0} <span className="text-sm font-normal text-muted-foreground">{t('streak.days', 'days')}</span></p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-card rounded-xl p-4 border"
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Check className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">{t('streak.totalCompleted', 'Total Completed')}</span>
            </div>
            <p className="text-2xl font-bold">{data?.totalCompletions || 0} <span className="text-sm font-normal text-muted-foreground">{t('streak.tasks', 'tasks')}</span></p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-xl p-4 border"
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Calendar className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">{t('streak.thisWeek', 'This Week')}</span>
            </div>
            <p className="text-2xl font-bold">{weekStats.completed} <span className="text-sm font-normal text-muted-foreground">{t('streak.tasks', 'tasks')}</span></p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-card rounded-xl p-4 border"
          >
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Snowflake className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">{t('streak.freezes', 'Freezes')}</span>
            </div>
            <p className="text-2xl font-bold">{data?.streakFreezes || 0}</p>
          </motion.div>
        </div>
        
        {/* Milestones */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-xl p-4 border"
        >
          <h3 className="font-semibold mb-4">{t('streak.milestones', 'Milestones')}</h3>
          <div className="grid grid-cols-4 gap-3">
            {milestones.map((milestone) => {
              const achieved = data?.milestones?.includes(milestone.value);
              const Icon = milestone.icon;
              
              return (
                <div 
                  key={milestone.value}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                    achieved 
                      ? "border-primary/50 bg-primary/5" 
                      : "border-muted bg-muted/30 opacity-50"
                  )}
                >
                  <Icon className={cn("h-6 w-6", achieved ? milestone.color : "text-muted-foreground")} />
                  <span className="text-xs font-medium text-center">{milestone.label}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
        
        {/* At Risk Warning */}
        <AnimatePresence>
          {atRisk && !completedToday && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 flex items-center gap-3"
            >
              <Flame className="h-5 w-5 text-orange-500 flex-shrink-0" />
              <p className="text-sm text-orange-700 dark:text-orange-300">
                {t('streak.atRiskWarning', 'Complete one task today to keep your streak going!')}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TodoLayout>
  );
};

export default Progress;
