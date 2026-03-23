import React, { useMemo } from 'react';

const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface CalendarStripProps {
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

export const CalendarStrip: React.FC<CalendarStripProps> = ({
  currentDate,
  onDateSelect,
}) => {
  const stripDays = useMemo(() => {
    const days = [];
    const start = new Date(currentDate);
    start.setDate(currentDate.getDate() - 3);
    for (let i = 0; i < 14; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  return (
    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 mask-linear-fade">
      {stripDays.map((date, index) => {
        const active = isSameDay(date, currentDate);
        return (
          <div
            key={index}
            onClick={() => onDateSelect(date)}
            className="flex flex-col items-center gap-2 cursor-pointer group flex-shrink-0 min-w-[50px]"
          >
            <span
              className={`text-lg font-bold transition-colors ${
                active ? 'text-primary' : 'text-slate-800 dark:text-slate-100'
              }`}
            >
              {date.getDate()}
            </span>
            <div
              className={`
                flex flex-col items-center justify-center w-10 h-14 rounded-2xl transition-all duration-300
                ${
                  active
                    ? 'bg-pink-50 dark:bg-pink-950 shadow-lg translate-y-[-2px]'
                    : 'bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800'
                }
              `}
            >
              <span
                className={`text-xs font-medium ${
                  active ? 'text-primary' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {daysOfWeek[date.getDay()]}
              </span>
              {active && (
                <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1"></div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
