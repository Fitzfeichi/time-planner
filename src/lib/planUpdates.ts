import type { PlansByDate } from '../types.ts';
import { getMergedRangeForSlot, getMergedRangeSlotIds } from './mergedRanges.ts';
import { createEmptyDayPlan } from './timeSlots.ts';

export function updateSlotPlanForDate(
  plansByDate: PlansByDate,
  dateKey: string,
  slotId: string,
  plan: string,
) {
  const dayPlan = plansByDate[dateKey] ?? createEmptyDayPlan();
  const mergedRange = getMergedRangeForSlot(dayPlan.slots, dayPlan.mergedRanges, slotId);
  const slotIdsToUpdate = new Set(
    mergedRange === null ? [slotId] : getMergedRangeSlotIds(dayPlan.slots, mergedRange),
  );

  return {
    ...plansByDate,
    [dateKey]: {
      ...dayPlan,
      slots: dayPlan.slots.map((slot) =>
        slotIdsToUpdate.has(slot.id)
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
