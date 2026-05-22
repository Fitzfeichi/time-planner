import type { TimeSlot } from '../types';

export interface MoveSelectedSlotPlansResult {
  didMove: boolean;
  movedSlotIds: string[];
  slots: TimeSlot[];
}

export function moveSelectedSlotPlans(
  slots: TimeSlot[],
  selectedSlotIds: string[],
  insertIndex: number,
): MoveSelectedSlotPlansResult {
  const slotIndexById = new Map(slots.map((slot, index) => [slot.id, index]));
  const clampedInsertIndex = Math.max(0, Math.min(insertIndex, slots.length));

  const selectedIndices = Array.from(new Set(selectedSlotIds))
    .map((slotId) => slotIndexById.get(slotId))
    .filter((index): index is number => index !== undefined)
    .sort((first, second) => first - second);

  const selectedBoundaryIndexes = new Set(
    selectedIndices.flatMap((selectedIndex) => [selectedIndex, selectedIndex + 1]),
  );

  if (selectedIndices.length === 0 || selectedBoundaryIndexes.has(clampedInsertIndex)) {
    return {
      didMove: false,
      movedSlotIds: selectedIndices.map((index) => slots[index].id),
      slots,
    };
  }

  const selectedIndexSet = new Set(selectedIndices);
  const selectedPlans = selectedIndices.map((index) => slots[index].plan);
  const remainingPlans = slots
    .filter((_, index) => !selectedIndexSet.has(index))
    .map((slot) => slot.plan);
  const destinationStartIndex = Math.min(
    clampedInsertIndex,
    slots.length - selectedIndices.length,
  );
  const destinationIndices = Array.from(
    { length: selectedIndices.length },
    (_, offset) => destinationStartIndex + offset,
  );
  const destinationIndexSet = new Set(destinationIndices);
  let selectedPlanIndex = 0;
  let remainingPlanIndex = 0;

  const nextSlots = slots.map((slot, index) => {
    if (destinationIndexSet.has(index)) {
      const plan = selectedPlans[selectedPlanIndex];
      selectedPlanIndex += 1;
      return {
        ...slot,
        plan,
      };
    }

    const plan = remainingPlans[remainingPlanIndex];
    remainingPlanIndex += 1;
    return {
      ...slot,
      plan,
    };
  });

  return {
    didMove: true,
    movedSlotIds: destinationIndices.map((index) => slots[index].id),
    slots: nextSlots,
  };
}
