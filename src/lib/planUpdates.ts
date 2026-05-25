import type { PlansByDate } from '../types.js';
import { createEmptyDayPlan } from './timeSlots.js';

export function updateSlotPlanForDate(
  plansByDate: PlansByDate,
  dateKey: string,
  slotId: string,
  plan: string,
) {
  const dayPlan = plansByDate[dateKey] ?? createEmptyDayPlan();

  return {
    ...plansByDate,
    [dateKey]: {
      ...dayPlan,
      slots: dayPlan.slots.map((slot) =>
        slot.id === slotId
          ? {
              ...slot,
              plan,
              status: slot.status === 'empty' && plan.trim() ? 'planned' : slot.status,
            }
          : slot,
      ),
    },
  };
}
