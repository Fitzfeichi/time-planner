import type { TimeSlot } from '../types';

const NIGHT_FOLD_START_INDEX = 1;
const NIGHT_FOLD_END_INDEX = 15;

function getSlotIndex(slotId: string) {
  if (!slotId.startsWith('slot-')) {
    return null;
  }

  const slotIndex = Number(slotId.slice(5));

  return Number.isInteger(slotIndex) ? slotIndex : null;
}

export function isNightFoldSlot(slotId: string) {
  const slotIndex = getSlotIndex(slotId);

  return (
    slotIndex !== null &&
    slotIndex >= NIGHT_FOLD_START_INDEX &&
    slotIndex <= NIGHT_FOLD_END_INDEX
  );
}

export function shouldExpandNightFoldForSlots(slots: TimeSlot[]) {
  return slots.some(
    (slot) =>
      isNightFoldSlot(slot.id) && (slot.plan.trim().length > 0 || slot.actual.trim().length > 0),
  );
}
