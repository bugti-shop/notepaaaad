import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Trophy, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ALL_ACHIEVEMENTS,
  Achievement,
  loadAchievementsData,
  AchievementsData,
} from '@/utils/gamificationStorage';

interface AchievementBadgesProps {
  compact?: boolean;
}

export const AchievementBadges = ({ compact = false }: AchievementBadgesProps) => {
  const { t } = useTranslation();
  const [achievementsData, setAchievementsData] = useState<AchievementsData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'streak' | 'tasks' | 'consistency' | 'special'>('all');

  useEffect(() => {
    const loadData = async () => {
      const data = await loadAchievementsData();
      setAchievementsData(data);
    };
    loadData();

    const handleUnlock = () => loadData();
    window.addEventListener('achievementUnlocked', handleUnlock);
    return () => window.removeEventListener('achievementUnlocked', handleUnlock);
  }, []);

  if (!achievementsData) return null;

  const categories = [
    { id: 'all', label: t('achievements.all', 'All') },
    { id: 'streak', label: t('achievements.streak', 'Streak') },
    { id: 'tasks', label: t('achievements.tasks', 'Tasks') },
    { id: 'consistency', label: t('achievements.consistency', 'Daily') },
    { id: 'special', label: t('achievements.special', 'Special') },
  ] as const;

  const filteredAchievements = selectedCategory === 'all' 
    ? ALL_ACHIEVEMENTS 
    : ALL_ACHIEVEMENTS.filter(a => a.category === selectedCategory);

  const unlockedCount = achievementsData.unlockedAchievements.length;
  const totalCount = ALL_ACHIEVEMENTS.length;

  if (compact) {
    // Compact view for dashboard
    const recentUnlocked = ALL_ACHIEVEMENTS
      .filter(a => achievementsData.unlockedAchievements.includes(a.id))
      .slice(0, 5);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl p-4 border"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <h3 className="font-semibold text-sm">{t('achievements.title', 'Achievements')}</h3>
          </div>
          <span className="text-xs text-muted-foreground">{unlockedCount}/{totalCount}</span>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {recentUnlocked.length > 0 ? (
            recentUnlocked.map((achievement) => (
              <motion.div
                key={achievement.id}
                whileHover={{ scale: 1.1 }}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-lg shadow-md"
                title={achievement.name}
              >
                {achievement.icon}
              </motion.div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">{t('achievements.noneYet', 'Complete tasks to unlock badges!')}</p>
          )}
          {recentUnlocked.length > 0 && unlockedCount > 5 && (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
              +{unlockedCount - 5}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl p-4 border"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <h3 className="font-semibold">{t('achievements.title', 'Achievements')}</h3>
        </div>
        <span className="text-sm text-muted-foreground">{unlockedCount}/{totalCount}</span>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
              selectedCategory === cat.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Achievements Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
        {filteredAchievements.map((achievement) => {
          const isUnlocked = achievementsData.unlockedAchievements.includes(achievement.id);
          
          return (
            <motion.div
              key={achievement.id}
              whileHover={{ scale: 1.05 }}
              className={cn(
                "relative flex flex-col items-center gap-1 p-2 rounded-lg transition-all",
                isUnlocked 
                  ? "bg-gradient-to-br from-yellow-400/20 to-orange-500/20 border border-yellow-500/30" 
                  : "bg-muted/50 opacity-50"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center text-xl",
                isUnlocked 
                  ? "bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg" 
                  : "bg-muted"
              )}>
                {isUnlocked ? achievement.icon : <Lock className="h-5 w-5 text-muted-foreground" />}
              </div>
              <span className="text-[10px] font-medium text-center line-clamp-2 leading-tight">
                {achievement.name}
              </span>
              {isUnlocked && (
                <span className="text-[9px] text-yellow-600 dark:text-yellow-400">+{achievement.xpReward} XP</span>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};
