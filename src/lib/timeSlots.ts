import type { DayPlan, TimeSlot } from '../types';

function padTime(value: number) {
  return value.toString().padStart(2, '0');
}

function formatSlotTime(slotIndex: number) {
  const totalMinutes = slotIndex * 30;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${padTime(hours)}:${padTime(minutes)}`;
}

export function createTimeSlots(): TimeSlot[] {
  return Array.from({ length: 48 }, (_, index) => ({
    id: `slot-${index}`,
    start: formatSlotTime(index),
    end: index === 47 ? '24:00' : formatSlotTime(index + 1),
    plan: '',
    actual: '',
    status: 'empty',
  }));
}

export function createEmptyDayPlan(): DayPlan {
  return {
    slots: createTimeSlots(),
    review: '',
    mergedRanges: [],
  };
}

export function getCurrentSlotId(date: Date) {
  const currentIndex = date.getHours() * 2 + Math.floor(date.getMinutes() / 30);
  return `slot-${currentIndex}`;
}
