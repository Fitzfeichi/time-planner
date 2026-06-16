import type { ReactNode } from 'react';

interface DayHeaderProps {
  date: Date;
  updateAction?: ReactNode;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
}

const weekdayFormatter = new Intl.DateTimeFormat('zh-CN', {
  weekday: 'long',
});

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export function DayHeader({ date, updateAction, onPreviousDay, onNextDay, onToday }: DayHeaderProps) {
  return (
    <header className="day-header">
      <div>
        <p className="eyebrow">半小时日计划</p>
        <h1>{dateFormatter.format(date)}</h1>
        <p className="weekday">{weekdayFormatter.format(date)}</p>
      </div>

      <nav className="day-actions" aria-label="日期和软件操作">
        {updateAction}
        <button type="button" onClick={onPreviousDay}>
          前一天
        </button>
        <button type="button" className="primary-button" onClick={onToday}>
          回到今天
        </button>
        <button type="button" onClick={onNextDay}>
          后一天
        </button>
      </nav>
    </header>
  );
}
