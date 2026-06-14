import { getMergedRangeForSlot, getMergedRangeSlotIds } from './mergedRanges.ts';
import type { MergedTimeRange, TimeSlot } from '../types';

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

function getSlotWithTaskBlockTime(
  slots: TimeSlot[],
  slot: TimeSlot | null,
  mergedRanges: MergedTimeRange[],
) {
  if (slot === null) {
    return null;
  }

  const mergedRange = getMergedRangeForSlot(slots, mergedRanges, slot.id);

  if (mergedRange === null) {
    return slot;
  }

  const rangeSlotIds = getMergedRangeSlotIds(slots, mergedRange);
  const startSlot = slots.find((item) => item.id === rangeSlotIds[0]);
  const endSlot = slots.find((item) => item.id === rangeSlotIds[rangeSlotIds.length - 1]);

  if (startSlot === undefined || endSlot === undefined) {
    return slot;
  }

  return {
    ...slot,
    start: startSlot.start,
    end: endSlot.end,
  };
}

export function getTaskBlockNeighbors(
  slots: TimeSlot[],
  currentSlotId: string,
  mergedRanges: MergedTimeRange[] = [],
): SlotNeighbors {
  const currentIndex = slots.findIndex((slot) => slot.id === currentSlotId);

  if (currentIndex === -1) {
    return {
      previous: null,
      current: null,
      next: null,
    };
  }

  const currentMergedRange = getMergedRangeForSlot(slots, mergedRanges, currentSlotId);
  const currentBlockSlotIds =
    currentMergedRange === null
      ? [currentSlotId]
      : getMergedRangeSlotIds(slots, currentMergedRange);
  const currentBlockStartIndex = slots.findIndex((slot) => slot.id === currentBlockSlotIds[0]);
  const currentBlockEndIndex = slots.findIndex(
    (slot) => slot.id === currentBlockSlotIds[currentBlockSlotIds.length - 1],
  );
  const previousSlot =
    currentBlockStartIndex === -1
      ? slots[currentIndex - 1] ?? null
      : slots[currentBlockStartIndex - 1] ?? null;
  const nextSlot =
    currentBlockEndIndex === -1
      ? slots[currentIndex + 1] ?? null
      : slots[currentBlockEndIndex + 1] ?? null;

  return {
    previous: getSlotWithTaskBlockTime(slots, previousSlot, mergedRanges),
    current: getSlotWithTaskBlockTime(slots, slots[currentIndex], mergedRanges),
    next: getSlotWithTaskBlockTime(slots, nextSlot, mergedRanges),
  };
}
