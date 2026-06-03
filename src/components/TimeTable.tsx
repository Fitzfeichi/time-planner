import { useState, type DragEvent, type MouseEvent } from 'react';
import { getMergedRangeForSlot, getMergedRangeSlotIds } from '../lib/mergedRanges';
import { isNightFoldSlot } from '../lib/nightFold';
import { statusLabels } from '../lib/status';
import type { MergedTimeRange, SlotSelectionMode, TimeSlot } from '../types';

type DropIndicatorPosition = 'before' | 'after';

interface DropIndicator {
  slotId: string;
  position: DropIndicatorPosition;
  insertIndex: number;
}

interface TimeTableProps {
  slots: TimeSlot[];
  daySlots: TimeSlot[];
  mergedRanges?: MergedTimeRange[];
  selectedSlotId: string;
  selectedSlotIds: string[];
  currentSlotId: string | null;
  isNightFoldExpanded: boolean;
  onSelectSlot: (slotId: string, mode: SlotSelectionMode) => void;
  onEditSlotPlan: (slotId: string) => void;
  onMoveSelectedPlans: (dragStartSlotId: string, insertIndex: number) => void;
  onExpandNightFold: () => void;
}

export function TimeTable({
  slots,
  daySlots,
  mergedRanges = [],
  selectedSlotId,
  selectedSlotIds,
  currentSlotId,
  isNightFoldExpanded,
  onSelectSlot,
  onEditSlotPlan,
  onMoveSelectedPlans,
  onExpandNightFold,
}: TimeTableProps) {
  const [draggedSlotId, setDraggedSlotId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);

  function clearDragState() {
    setDraggedSlotId(null);
    setDropIndicator(null);
  }

  function scrollListNearEdge(event: DragEvent<HTMLButtonElement>) {
    const listElement = event.currentTarget.closest('.slot-list');

    if (!(listElement instanceof HTMLElement)) {
      return;
    }

    const edgeSize = 56;
    const scrollStep = 12;
    const listRect = listElement.getBoundingClientRect();
    const distanceFromTop = event.clientY - listRect.top;
    const distanceFromBottom = listRect.bottom - event.clientY;

    if (distanceFromTop < edgeSize) {
      listElement.scrollTop -= scrollStep;
    } else if (distanceFromBottom < edgeSize) {
      listElement.scrollTop += scrollStep;
    }
  }

  function getSlotIndex(slotId: string) {
    return slots.findIndex((slot) => slot.id === slotId);
  }

  function getDraggedSlotIds(slotId: string) {
    return selectedSlotIds.includes(slotId) ? selectedSlotIds : [slotId];
  }

  function isInsertInsideDraggedSelection(insertIndex: number, slotId: string) {
    const draggedSlotIds = getDraggedSlotIds(slotId);
    const selectedBoundaryIndexes = new Set<number>();

    draggedSlotIds.forEach((draggedSlotId) => {
      const selectedIndex = getSlotIndex(draggedSlotId);

      if (selectedIndex !== -1) {
        selectedBoundaryIndexes.add(selectedIndex);
        selectedBoundaryIndexes.add(selectedIndex + 1);
      }
    });

    return selectedBoundaryIndexes.has(insertIndex);
  }

  function getDropIndicator(
    event: DragEvent<HTMLButtonElement>,
    slotId: string,
    activeDraggedSlotId = draggedSlotId,
  ): DropIndicator | null {
    if (activeDraggedSlotId === null) {
      return null;
    }

    const slotIndex = getSlotIndex(slotId);

    if (slotIndex === -1) {
      return null;
    }

    const rowRect = event.currentTarget.getBoundingClientRect();
    const position: DropIndicatorPosition =
      event.clientY < rowRect.top + rowRect.height / 2 ? 'before' : 'after';
    const insertIndex = slotIndex + (position === 'after' ? 1 : 0);

    if (isInsertInsideDraggedSelection(insertIndex, activeDraggedSlotId)) {
      return null;
    }

    return {
      slotId,
      position,
      insertIndex,
    };
  }

  function getSelectionMode(event: MouseEvent<HTMLButtonElement>): SlotSelectionMode {
    if (event.shiftKey) {
      return 'range';
    }

    if (event.ctrlKey || event.metaKey) {
      return 'toggle';
    }

    return 'replace';
  }

  function handleSlotClick(event: MouseEvent<HTMLButtonElement>, slotId: string) {
    onSelectSlot(slotId, getSelectionMode(event));
  }

  function handleSlotDoubleClick(event: MouseEvent<HTMLButtonElement>, slotId: string) {
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      return;
    }

    onEditSlotPlan(slotId);
  }

  function handleDragStart(event: DragEvent<HTMLButtonElement>, slotId: string) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', slotId);
    if (!selectedSlotIds.includes(slotId)) {
      onSelectSlot(slotId, 'replace');
    }
    setDraggedSlotId(slotId);
  }

  function handleDragOver(event: DragEvent<HTMLButtonElement>, slotId: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropIndicator(getDropIndicator(event, slotId));
    scrollListNearEdge(event);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>, slotId: string) {
    event.preventDefault();

    const fromSlotId = event.dataTransfer.getData('text/plain') || draggedSlotId;
    const nextDropIndicator = getDropIndicator(event, slotId, fromSlotId);

    if (fromSlotId !== null && nextDropIndicator !== null) {
      onMoveSelectedPlans(fromSlotId, nextDropIndicator.insertIndex);
    }

    clearDragState();
  }

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
          const mergedRange = getMergedRangeForSlot(daySlots, mergedRanges, slot.id);
          const mergedRangeSlotIds =
            mergedRange === null ? [slot.id] : getMergedRangeSlotIds(daySlots, mergedRange);
          const isMergedRangeStart =
            mergedRange === null || mergedRange.startSlotId === slot.id;

          if (!isMergedRangeStart) {
            return null;
          }

          if (!isNightFoldExpanded && isNightFoldSlot(slot.id)) {
            if (slot.id !== 'slot-1') {
              return null;
            }

            const isCurrentFold = currentSlotId !== null && isNightFoldSlot(currentSlotId);

            return (
              <button
                type="button"
                key="night-fold"
                className={['slot-row', 'night-fold-row', isCurrentFold ? 'current' : '']
                  .filter(Boolean)
                  .join(' ')}
                onClick={onExpandNightFold}
              >
                <span className="slot-time">00:30 - 08:00</span>
                <span className="slot-text">夜间时间已折叠</span>
                <span className="slot-text">已隐藏 15 个时间格，点击展开</span>
                <span className="status-pill">夜间</span>
              </button>
            );
          }

          const daySlot = daySlots.find((item) => item.id === slot.id) ?? slot;
          const rangeEndSlot =
            mergedRange === null
              ? daySlot
              : daySlots.find((item) => item.id === mergedRange.endSlotId) ?? daySlot;
          const displayEnd = mergedRange === null ? daySlot.end : rangeEndSlot.end;
          const isSelected = mergedRangeSlotIds.some((slotId) => selectedSlotIds.includes(slotId));
          const isFocused = mergedRangeSlotIds.includes(selectedSlotId);
          const isCurrent = currentSlotId !== null && mergedRangeSlotIds.includes(currentSlotId);
          const isDraggingSelectedGroup =
            draggedSlotId !== null && selectedSlotIds.includes(draggedSlotId);
          const isDragging =
            daySlot.id === draggedSlotId || (isDraggingSelectedGroup && isSelected);
          const isDropBefore =
            dropIndicator?.slotId === daySlot.id && dropIndicator.position === 'before';
          const isDropAfter =
            dropIndicator?.slotId === daySlot.id && dropIndicator.position === 'after';

          return (
            <button
              type="button"
              key={slot.id}
              data-slot-id={daySlot.id}
              aria-pressed={isSelected}
              draggable={mergedRange === null}
              className={[
                'slot-row',
                `status-${daySlot.status}`,
                mergedRange === null ? '' : 'merged-range',
                isSelected ? 'selected' : '',
                isFocused ? 'focused' : '',
                isCurrent ? 'current' : '',
                isDragging ? 'dragging' : '',
                isDropBefore ? 'drop-before' : '',
                isDropAfter ? 'drop-after' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={(event) => handleSlotClick(event, daySlot.id)}
              onDoubleClick={(event) => handleSlotDoubleClick(event, daySlot.id)}
              onDragStart={(event) => handleDragStart(event, daySlot.id)}
              onDragOver={(event) => handleDragOver(event, daySlot.id)}
              onDrop={(event) => handleDrop(event, daySlot.id)}
              onDragEnd={clearDragState}
            >
              <span className="slot-time">
                {daySlot.start} - {displayEnd}
              </span>
              <span className="slot-text">{daySlot.plan}</span>
              <span className="slot-text">{daySlot.actual}</span>
              <span className="status-pill">{statusLabels[daySlot.status]}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
