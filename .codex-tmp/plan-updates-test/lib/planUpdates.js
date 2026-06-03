import { getMergedRangeForSlot, getMergedRangeSlotIds } from './mergedRanges.js';
import { createEmptyDayPlan } from './timeSlots.js';
export function updateSlotPlanForDate(plansByDate, dateKey, slotId, plan) {
    const dayPlan = plansByDate[dateKey] ?? createEmptyDayPlan();
    const mergedRange = getMergedRangeForSlot(dayPlan.slots, dayPlan.mergedRanges, slotId);
    const slotIdsToUpdate = new Set(mergedRange === null ? [slotId] : getMergedRangeSlotIds(dayPlan.slots, mergedRange));
    return {
        ...plansByDate,
        [dateKey]: {
            ...dayPlan,
            slots: dayPlan.slots.map((slot) => slotIdsToUpdate.has(slot.id)
                ? {
                    ...slot,
                    plan,
                    status: slot.status === 'empty' && plan.trim() ? 'planned' : slot.status,
                }
                : slot),
        },
    };
}
