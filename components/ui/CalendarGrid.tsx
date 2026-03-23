import React, { useMemo } from 'react';

const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface CalendarGridProps {
  displayMonth: Date;
  currentDate: Date;
  onDateSelect: (date: Date) => void;
}

const isSameDay = (d1: Date, d2: Date) => {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  displayMonth,
  currentDate,
  onDateSelect,
}) => {
  const today = new Date();

  const gridDays = useMemo(() => {
    const year = displayMonth.getFullYear();
    const month = displayMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  }, [displayMonth]);

  return (
    <div className="animate-in fade-in zoom-in duration-200">
      <div className="grid grid-cols-7 mb-2 text-center">
        {daysOfWeek.map((d) => (
          <span key={d} className="text-xs font-medium text-slate-400 dark:text-slate-500">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-2 gap-x-1 justify-items-center">
        {gridDays.map((date, i) => {
          if (!date) return <div key={i} className="w-8 h-8" />;
          const active = isSameDay(date, currentDate);
          const isToday = isSameDay(date, today);
          return (
            <button
              key={i}
              onClick={() => onDateSelect(date)}
              className={`
                w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-all
                ${
                  active
                    ? 'bg-primary text-white shadow-glow-primary scale-110'
                    : isToday
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }
              `}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
};
