import React, { useState, useMemo, useCallback } from 'react';
import Picker from 'react-mobile-picker';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar, Clock, ChevronDown } from 'lucide-react';

// ==================== Date Picker ====================

interface DatePickerSheetProps {
  value: string; // "YYYY-MM-DD" or ""
  onChange: (value: string) => void;
  min?: string; // "YYYY-MM-DD"
  max?: string; // "YYYY-MM-DD"
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function DatePickerSheet({
  value,
  onChange,
  min,
  max,
  placeholder = '选择日期',
  className = '',
  disabled = false,
}: DatePickerSheetProps) {
  const [open, setOpen] = useState(false);

  const now = new Date();
  const minDate = min ? new Date(min + 'T00:00:00') : new Date(2020, 0, 1);
  const maxDate = max ? new Date(max + 'T00:00:00') : new Date(now.getFullYear() + 5, 11, 31);

  const parsed = value ? value.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1, now.getDate()];
  const [pickerValue, setPickerValue] = useState({
    year: String(parsed[0]),
    month: String(parsed[1]).padStart(2, '0'),
    day: String(parsed[2]).padStart(2, '0'),
  });

  const years = useMemo(() => {
    const arr: string[] = [];
    for (let y = minDate.getFullYear(); y <= maxDate.getFullYear(); y++) arr.push(String(y));
    return arr;
  }, [minDate, maxDate]);

  const months = useMemo(() => {
    const y = Number(pickerValue.year);
    const arr: string[] = [];
    const startM = y === minDate.getFullYear() ? minDate.getMonth() + 1 : 1;
    const endM = y === maxDate.getFullYear() ? maxDate.getMonth() + 1 : 12;
    for (let m = startM; m <= endM; m++) arr.push(String(m).padStart(2, '0'));
    return arr;
  }, [pickerValue.year, minDate, maxDate]);

  const days = useMemo(() => {
    const y = Number(pickerValue.year);
    const m = Number(pickerValue.month);
    const totalDays = getDaysInMonth(y, m);
    const arr: string[] = [];
    const startD = (y === minDate.getFullYear() && m === minDate.getMonth() + 1) ? minDate.getDate() : 1;
    const endD = (y === maxDate.getFullYear() && m === maxDate.getMonth() + 1) ? Math.min(maxDate.getDate(), totalDays) : totalDays;
    for (let d = startD; d <= endD; d++) arr.push(String(d).padStart(2, '0'));
    return arr;
  }, [pickerValue.year, pickerValue.month, minDate, maxDate]);

  const handleChange = useCallback((val: Record<string, string>) => {
    // Clamp month and day when year/month changes
    let month = val.month;
    if (!months.includes(month)) month = months[months.length - 1] || '01';

    const y = Number(val.year);
    const m = Number(month);
    const totalDays = getDaysInMonth(y, m);
    let day = val.day;
    if (Number(day) > totalDays) day = String(totalDays).padStart(2, '0');

    const tempDays = (() => {
      const arr: string[] = [];
      const startD = (y === minDate.getFullYear() && m === minDate.getMonth() + 1) ? minDate.getDate() : 1;
      const endD = (y === maxDate.getFullYear() && m === maxDate.getMonth() + 1) ? Math.min(maxDate.getDate(), totalDays) : totalDays;
      for (let d = startD; d <= endD; d++) arr.push(String(d).padStart(2, '0'));
      return arr;
    })();
    if (!tempDays.includes(day)) day = tempDays[tempDays.length - 1] || '01';

    setPickerValue({ year: val.year, month, day });
  }, [months, minDate, maxDate]);

  const handleConfirm = () => {
    const result = `${pickerValue.year}-${pickerValue.month}-${pickerValue.day}`;
    onChange(result);
    setOpen(false);
  };

  const displayText = value || '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={`flex items-center gap-2 w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-left transition-colors hover:border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          } ${className}`}
        >
          <Calendar size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
          <span className={displayText ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}>{displayText || placeholder}</span>
          <ChevronDown size={14} className="ml-auto text-slate-400 dark:text-slate-500 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="px-4 pt-3 pb-2 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">选择日期</span>
          <button
            onClick={handleConfirm}
            className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            确定
          </button>
        </div>
        <div className="px-2 py-1">
          <Picker value={pickerValue} onChange={handleChange} wheelMode="natural" height={180}>
            <Picker.Column name="year">
              {years.map(y => <Picker.Item key={y} value={y}>{y}年</Picker.Item>)}
            </Picker.Column>
            <Picker.Column name="month">
              {months.map(m => <Picker.Item key={m} value={m}>{Number(m)}月</Picker.Item>)}
            </Picker.Column>
            <Picker.Column name="day">
              {days.map(d => <Picker.Item key={d} value={d}>{Number(d)}日</Picker.Item>)}
            </Picker.Column>
          </Picker>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ==================== Time Picker ====================

interface TimePickerSheetProps {
  value: string; // "HH:MM" or ""
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function TimePickerSheet({
  value,
  onChange,
  placeholder = '选择时间',
  className = '',
  disabled = false,
}: TimePickerSheetProps) {
  const [open, setOpen] = useState(false);

  const parsed = value ? value.split(':').map(Number) : [12, 0];
  const [pickerValue, setPickerValue] = useState({
    hour: String(parsed[0]).padStart(2, '0'),
    minute: String(parsed[1]).padStart(2, '0'),
  });

  const hours = useMemo(() => {
    const arr: string[] = [];
    for (let h = 0; h < 24; h++) arr.push(String(h).padStart(2, '0'));
    return arr;
  }, []);

  const minutes = useMemo(() => {
    const arr: string[] = [];
    for (let m = 0; m < 60; m++) arr.push(String(m).padStart(2, '0'));
    return arr;
  }, []);

  const handleConfirm = () => {
    onChange(`${pickerValue.hour}:${pickerValue.minute}`);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={`flex items-center gap-2 w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-left transition-colors hover:border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none ${
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          } ${className}`}
        >
          <Clock size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
          <span className={value ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}>{value || placeholder}</span>
          <ChevronDown size={14} className="ml-auto text-slate-400 dark:text-slate-500 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <div className="px-4 pt-3 pb-2 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">选择时间</span>
          <button
            onClick={handleConfirm}
            className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            确定
          </button>
        </div>
        <div className="px-2 py-1">
          <Picker value={pickerValue} onChange={(val) => setPickerValue(val as typeof pickerValue)} wheelMode="natural" height={180}>
            <Picker.Column name="hour">
              {hours.map(h => <Picker.Item key={h} value={h}>{h}时</Picker.Item>)}
            </Picker.Column>
            <Picker.Column name="minute">
              {minutes.map(m => <Picker.Item key={m} value={m}>{m}分</Picker.Item>)}
            </Picker.Column>
          </Picker>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ==================== DateTime Picker ====================

interface DateTimePickerSheetProps {
  value: string; // "YYYY-MM-DDTHH:MM" or ""
  onChange: (value: string) => void;
  min?: string; // "YYYY-MM-DDTHH:MM"
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DateTimePickerSheet({
  value,
  onChange,
  min,
  placeholder = '选择日期和时间',
  className = '',
  disabled = false,
}: DateTimePickerSheetProps) {
  const datePart = value ? value.slice(0, 10) : '';
  const timePart = value ? value.slice(11, 16) : '';
  const minDate = min ? min.slice(0, 10) : undefined;

  const handleDateChange = (date: string) => {
    const time = timePart || '12:00';
    onChange(`${date}T${time}`);
  };

  const handleTimeChange = (time: string) => {
    const date = datePart || new Date().toISOString().slice(0, 10);
    onChange(`${date}T${time}`);
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <div className="flex-1">
        <DatePickerSheet
          value={datePart}
          onChange={handleDateChange}
          min={minDate}
          placeholder="日期"
          disabled={disabled}
        />
      </div>
      <div className="flex-1">
        <TimePickerSheet
          value={timePart}
          onChange={handleTimeChange}
          placeholder="时间"
          disabled={disabled}
        />
      </div>
    </div>
  );
}

// ==================== Color Picker ====================

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
}

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#14B8A6', '#3B82F6', '#8B5CF6', '#EC4899',
  '#6B7280', '#1E293B', '#888888', '#FFFFFF',
];

export function ColorPicker({ value, onChange, className = '' }: ColorPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`w-7 h-7 rounded-lg border-2 border-white shadow-sm cursor-pointer transition-transform hover:scale-110 ${className}`}
          style={{ backgroundColor: value || '#888888' }}
          title="选择颜色"
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="grid grid-cols-4 gap-2">
          {PRESET_COLORS.map(color => (
            <button
              key={color}
              onClick={() => { onChange(color); setOpen(false); }}
              className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 ${
                value === color ? 'border-slate-800 ring-2 ring-offset-1 ring-slate-400' : 'border-slate-200 dark:border-slate-700'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="color"
            value={value || '#888888'}
            onChange={(e) => { onChange(e.target.value); setOpen(false); }}
            className="w-8 h-8 rounded cursor-pointer border-none bg-transparent p-0"
          />
          <span className="text-xs text-slate-500 dark:text-slate-400">自定义颜色</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
