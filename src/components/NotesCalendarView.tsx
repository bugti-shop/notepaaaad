import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, getWeek, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Note } from "@/types/note";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface NotesCalendarViewProps {
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  highlightedDates?: Date[];
  taskDates?: Date[];
  eventDates?: Date[];
  systemCalendarDates?: Date[];
  showWeekNumbers?: boolean;
}

export const NotesCalendarView = ({
  selectedDate,
  onDateSelect,
  highlightedDates,
  taskDates = [],
  eventDates = [],
  systemCalendarDates = [],
  showWeekNumbers: initialShowWeekNumbers = false,
}: NotesCalendarViewProps) => {
  const today = new Date();
  const [currentMonthOffset, setCurrentMonthOffset] = useState(0);
  const [noteDates, setNoteDates] = useState<Date[]>([]);
  const [showWeekNumbers, setShowWeekNumbers] = useState(initialShowWeekNumbers);

  useEffect(() => {
    // If highlightedDates prop is provided, use it instead of loading notes
    if (highlightedDates) {
      setNoteDates(highlightedDates);
      return;
    }

    // Load notes from IndexedDB and extract dates
    const loadNotes = async () => {
      const { loadNotesFromDB } = await import('@/utils/noteStorage');
      const notes = await loadNotesFromDB();
      const dates = notes.map(note => new Date(note.createdAt));
      setNoteDates(dates);
    };

    loadNotes();

    // Listen for notes updates
    const handleNotesUpdate = () => loadNotes();
    window.addEventListener('notesUpdated', handleNotesUpdate);

    return () => window.removeEventListener('notesUpdated', handleNotesUpdate);
  }, [highlightedDates]);

  // Calculate display month
  const startingMonth = startOfMonth(today);
  const displayMonth = addMonths(startingMonth, currentMonthOffset);
  const monthStart = startOfMonth(displayMonth);
  const monthEnd = endOfMonth(displayMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startPadding = getDay(monthStart);
  const weekDays = showWeekNumbers ? ["Wk", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Calculate weeks for week numbers
  const weeksInMonth = useMemo(() => {
    const weeks: { weekNumber: number; days: (Date | null)[] }[] = [];
    let currentWeek: (Date | null)[] = Array(startPadding).fill(null);
    
    daysInMonth.forEach((day) => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        const firstDayOfWeek = currentWeek.find(d => d !== null);
        weeks.push({
          weekNumber: firstDayOfWeek ? getWeek(firstDayOfWeek) : 0,
          days: currentWeek,
        });
        currentWeek = [];
      }
    });
    
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      const firstDayOfWeek = currentWeek.find(d => d !== null);
      weeks.push({
        weekNumber: firstDayOfWeek ? getWeek(firstDayOfWeek) : 0,
        days: currentWeek,
      });
    }
    
    return weeks;
  }, [daysInMonth, startPadding]);

  const hasNote = (date: Date) => noteDates.some((nDate) => isSameDay(nDate, date));
  const hasTask = (date: Date) => taskDates.some((tDate) => isSameDay(tDate, date));
  const hasEvent = (date: Date) => eventDates.some((eDate) => isSameDay(eDate, date));
  const hasSystemCalendarEvent = (date: Date) => systemCalendarDates.some((sDate) => isSameDay(sDate, date));

  const handlePrevMonth = () => {
    setCurrentMonthOffset(prev => prev - 1);
  };

  const handleNextMonth = () => {
    setCurrentMonthOffset(prev => prev + 1);
  };

  return (
    <div className="w-full bg-background">
      {/* Month Header - Large and Bold like TickTick */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-2xl font-bold text-foreground">
          {format(displayMonth, "MMMM")}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevMonth}
            className="p-2 hover:bg-accent rounded-full transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-accent rounded-full transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </div>

      {/* Week Days Header - Full Width */}
      <div className={cn("grid px-2", showWeekNumbers ? "grid-cols-8" : "grid-cols-7")}>
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-medium text-muted-foreground py-3"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid - Large Cells */}
      <div className="px-2">
        {weeksInMonth.map((week, weekIndex) => (
          <div key={weekIndex} className={cn("grid", showWeekNumbers ? "grid-cols-8" : "grid-cols-7")}>
            {showWeekNumbers && (
              <div className="h-14 flex items-center justify-center text-xs font-medium text-muted-foreground">
                {week.weekNumber}
              </div>
            )}
            {week.days.map((day, dayIndex) => {
              if (!day) {
                return <div key={`empty-${weekIndex}-${dayIndex}`} className="h-14" />;
              }

              const hasNoteOnDay = hasNote(day);
              const hasTaskOnDay = hasTask(day);
              const hasEventOnDay = hasEvent(day);
              const hasSystemEventOnDay = hasSystemCalendarEvent(day);
              const isToday = isSameDay(day, today);
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <button
                  key={day.toString()}
                  onClick={() => onDateSelect?.(day)}
                  className={cn(
                    "h-14 flex flex-col items-center justify-center relative transition-all focus:outline-none",
                    "cursor-pointer"
                  )}
                >
                  <span 
                    className={cn(
                      "w-10 h-10 flex items-center justify-center rounded-full text-base font-medium transition-all",
                      isSelected 
                        ? "bg-primary text-primary-foreground" 
                        : isToday 
                          ? "bg-primary text-primary-foreground"
                          : hasNoteOnDay 
                            ? "text-foreground font-semibold" 
                            : "text-foreground hover:bg-muted"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {/* Colored dots for tasks, events, notes */}
                  {(hasTaskOnDay || hasEventOnDay || hasSystemEventOnDay || hasNoteOnDay) && (
                    <div className="flex gap-1 mt-0.5 absolute bottom-1">
                      {hasNoteOnDay && !hasTaskOnDay && !hasEventOnDay && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" title="Note" />
                      )}
                      {hasTaskOnDay && (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" title="Task" />
                      )}
                      {hasEventOnDay && (
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500" title="Event" />
                      )}
                      {hasSystemEventOnDay && (
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="Device" />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Week numbers toggle - moved below calendar */}
      <div className="flex items-center justify-end gap-2 px-4 py-2">
        <Label htmlFor="week-numbers" className="text-xs text-muted-foreground">Week #</Label>
        <Switch 
          id="week-numbers" 
          checked={showWeekNumbers} 
          onCheckedChange={setShowWeekNumbers}
          className="scale-75"
        />
      </div>

      {/* Legend */}
      {(taskDates.length > 0 || eventDates.length > 0 || systemCalendarDates.length > 0) && (
        <div className="flex items-center justify-center gap-4 px-4 py-2 text-xs text-muted-foreground flex-wrap">
          {taskDates.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Tasks</span>
            </div>
          )}
          {eventDates.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span>Events</span>
            </div>
          )}
          {systemCalendarDates.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Device</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
