import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getActivityHeatmap, HeatmapData } from '@/utils/gamificationStorage';
import { format, startOfWeek, getDay } from 'date-fns';

export const ActivityHeatmap = () => {
  const { t } = useTranslation();
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredDay, setHoveredDay] = useState<HeatmapData | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const data = await getActivityHeatmap();
      setHeatmapData(data);
      setIsLoading(false);
    };
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('xpUpdated', handleUpdate);
    return () => window.removeEventListener('xpUpdated', handleUpdate);
  }, []);

  // Group data by weeks
  const weeks = useMemo(() => {
    const grouped: HeatmapData[][] = [];
    let currentWeek: HeatmapData[] = [];
    
    heatmapData.forEach((day, index) => {
      const dayOfWeek = getDay(new Date(day.date));
      
      // Start new week on Sunday
      if (dayOfWeek === 0 && currentWeek.length > 0) {
        grouped.push(currentWeek);
        currentWeek = [];
      }
      
      currentWeek.push(day);
      
      if (index === heatmapData.length - 1) {
        grouped.push(currentWeek);
      }
    });
    
    return grouped;
  }, [heatmapData]);

  // Get months for labels
  const months = useMemo(() => {
    const monthLabels: { name: string; weekIndex: number }[] = [];
    let lastMonth = -1;
    
    weeks.forEach((week, weekIndex) => {
      const firstDay = week[0];
      if (firstDay) {
        const month = new Date(firstDay.date).getMonth();
        if (month !== lastMonth) {
          monthLabels.push({
            name: format(new Date(firstDay.date), 'MMM'),
            weekIndex,
          });
          lastMonth = month;
        }
      }
    });
    
    return monthLabels;
  }, [weeks]);

  const getLevelColor = (level: 0 | 1 | 2 | 3 | 4) => {
    const colors = {
      0: 'bg-muted',
      1: 'bg-green-200 dark:bg-green-900',
      2: 'bg-green-400 dark:bg-green-700',
      3: 'bg-green-500 dark:bg-green-600',
      4: 'bg-green-600 dark:bg-green-500',
    };
    return colors[level];
  };

  const totalActivity = heatmapData.reduce((sum, day) => sum + day.count, 0);
  const activeDays = heatmapData.filter(day => day.count > 0).length;

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl p-4 border animate-pulse">
        <div className="h-32 bg-muted rounded" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl p-4 border overflow-hidden"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-green-500" />
          <h3 className="font-semibold">{t('heatmap.title', 'Activity')}</h3>
        </div>
        <span className="text-sm text-muted-foreground">
          {totalActivity.toLocaleString()} XP {t('heatmap.thisYear', 'this year')}
        </span>
      </div>

      {/* Scrollable Heatmap Container */}
      <div className="overflow-x-auto pb-2">
        {/* Month Labels */}
        <div className="flex mb-1 text-[10px] text-muted-foreground h-4" style={{ paddingLeft: '28px' }}>
          {months.map((month, idx) => (
            <span
              key={idx}
              style={{ 
                position: 'absolute',
                left: `calc(28px + ${month.weekIndex * 12.5}px)`,
              }}
            >
              {month.name}
            </span>
          ))}
        </div>

        {/* Heatmap Grid */}
        <div className="flex gap-0.5">
          {/* Day Labels */}
          <div className="flex flex-col gap-0.5 mr-1 text-[10px] text-muted-foreground flex-shrink-0">
            <span className="h-[10px]"></span>
            <span className="h-[10px] leading-[10px]">Mon</span>
            <span className="h-[10px]"></span>
            <span className="h-[10px] leading-[10px]">Wed</span>
            <span className="h-[10px]"></span>
            <span className="h-[10px] leading-[10px]">Fri</span>
            <span className="h-[10px]"></span>
          </div>

          {/* Weeks */}
          <div className="flex gap-0.5">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-0.5">
                {/* Pad the first week if it doesn't start on Sunday */}
                {weekIndex === 0 && week.length < 7 && 
                  Array(7 - week.length).fill(null).map((_, i) => (
                    <div key={`pad-${i}`} className="w-[10px] h-[10px]" />
                  ))
                }
                {week.map((day) => (
                  <motion.div
                    key={day.date}
                    whileHover={{ scale: 1.5 }}
                    onMouseEnter={() => setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                    className={cn(
                      "w-[10px] h-[10px] rounded-[2px] cursor-pointer transition-colors",
                      getLevelColor(day.level)
                    )}
                    title={`${format(new Date(day.date), 'MMM d, yyyy')}: ${day.count} XP`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredDay && (
        <div className="mt-2 text-xs text-center text-muted-foreground">
          <span className="font-medium">{format(new Date(hoveredDay.date), 'MMMM d, yyyy')}</span>
          : {hoveredDay.count} XP earned
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t">
        <span className="text-xs text-muted-foreground">
          {activeDays} {t('heatmap.activeDays', 'active days')}
        </span>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span>{t('heatmap.less', 'Less')}</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={cn("w-[10px] h-[10px] rounded-[2px]", getLevelColor(level as 0 | 1 | 2 | 3 | 4))}
            />
          ))}
          <span>{t('heatmap.more', 'More')}</span>
        </div>
      </div>
    </motion.div>
  );
};
