import { statusLabels } from '../lib/status';
import type { TimeSlot } from '../types';

interface TimeTableProps {
  slots: TimeSlot[];
  daySlots: TimeSlot[];
  selectedSlotId: string;
  currentSlotId: string | null;
  onSelectSlot: (slotId: string) => void;
}

export function TimeTable({
  slots,
  daySlots,
  selectedSlotId,
  currentSlotId,
  onSelectSlot,
}: TimeTableProps) {
  return (
    <section className="time-table" aria-label="一天时间表">
      <div className="table-head">
        <span>时间</span>
        <span>计划</span>
        <span>实际</span>
        <span>状态</span>
      </div>

      <div className="slot-list">
        {slots.map((slot) => {
          const daySlot = daySlots.find((item) => item.id === slot.id) ?? slot;
          const isSelected = daySlot.id === selectedSlotId;
          const isCurrent = daySlot.id === currentSlotId;

          return (
            <button
              type="button"
              key={slot.id}
              data-slot-id={daySlot.id}
              className={[
                'slot-row',
                `status-${daySlot.status}`,
                isSelected ? 'selected' : '',
                isCurrent ? 'current' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelectSlot(daySlot.id)}
            >
              <span className="slot-time">
                {daySlot.start} - {daySlot.end}
              </span>
              <span className="slot-text">{daySlot.plan || '未填写计划'}</span>
              <span className="slot-text">{daySlot.actual || '未填写实际'}</span>
              <span className="status-pill">{statusLabels[daySlot.status]}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
