import type { TimeSlot } from '../types';

interface SlotNeighbors {
  previous: TimeSlot | null;
  current: TimeSlot | null;
  next: TimeSlot | null;
}

export function getSlotNeighbors(slots: TimeSlot[], currentSlotId: string): SlotNeighbors {
  const currentIndex = slots.findIndex((slot) => slot.id === currentSlotId);

  if (currentIndex === -1) {
    return {
      previous: null,
      current: null,
      next: null,
    };
  }

  return {
    previous: slots[currentIndex - 1] ?? null,
    current: slots[currentIndex],
    next: slots[currentIndex + 1] ?? null,
  };
}
