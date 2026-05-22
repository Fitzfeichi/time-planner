import { useEffect, useMemo, useState } from 'react';
import { CurrentTaskCard } from './components/CurrentTaskCard';
import { DayHeader } from './components/DayHeader';
import { ReviewPanel } from './components/ReviewPanel';
import { SlotEditor } from './components/SlotEditor';
import { TimeTable } from './components/TimeTable';
import { moveSelectedSlotPlans } from './lib/slotMoves';
import { createEmptyDayPlan, createTimeSlots, getCurrentSlotId } from './lib/timeSlots';
import type { DayPlan, PersistedAppState, SlotSelectionMode, SlotStatus, TimeSlot } from './types';

const STORAGE_KEY = 'time-manager-app-state';
const STORAGE_VERSION = 1;
const EXPECTED_SLOT_COUNT = 48;
const SLOT_STATUSES: SlotStatus[] = ['empty', 'planned', 'done', 'changed'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSlotStatus(value: unknown): value is SlotStatus {
  return typeof value === 'string' && SLOT_STATUSES.includes(value as SlotStatus);
}

function isValidTimeSlot(value: unknown): value is TimeSlot {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.start === 'string' &&
    typeof value.end === 'string' &&
    typeof value.plan === 'string' &&
    typeof value.actual === 'string' &&
    isSlotStatus(value.status)
  );
}

function isValidDayPlan(value: unknown): value is DayPlan {
  return (
    isRecord(value) &&
    typeof value.review === 'string' &&
    Array.isArray(value.slots) &&
    value.slots.length === EXPECTED_SLOT_COUNT &&
    value.slots.every(isValidTimeSlot)
  );
}

function isValidSavedState(value: unknown): value is PersistedAppState {
  if (!isRecord(value)) {
    return false;
  }

  if (
    value.version !== STORAGE_VERSION ||
    typeof value.currentDate !== 'string' ||
    typeof value.selectedSlotId !== 'string' ||
    !isValidDayPlan(value.dayPlan)
  ) {
    return false;
  }

  const savedDate = new Date(value.currentDate);
  const hasSelectedSlot = value.dayPlan.slots.some((slot) => slot.id === value.selectedSlotId);

  return !Number.isNaN(savedDate.getTime()) && hasSelectedSlot;
}

function loadSavedState() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const savedValue = window.localStorage.getItem(STORAGE_KEY);
    if (savedValue === null) {
      return null;
    }

    const parsedValue: unknown = JSON.parse(savedValue);
    return isValidSavedState(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

function saveState(state: PersistedAppState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable or full; the app should keep working in memory.
  }
}

function getSortedValidSlotIds(slots: TimeSlot[], slotIds: string[]) {
  const slotIndexById = new Map(slots.map((slot, index) => [slot.id, index]));

  return Array.from(new Set(slotIds))
    .filter((slotId) => slotIndexById.has(slotId))
    .sort((firstSlotId, secondSlotId) => {
      const firstIndex = slotIndexById.get(firstSlotId) ?? 0;
      const secondIndex = slotIndexById.get(secondSlotId) ?? 0;
      return firstIndex - secondIndex;
    });
}

function getSlotRangeIds(slots: TimeSlot[], firstSlotId: string, secondSlotId: string) {
  const firstIndex = slots.findIndex((slot) => slot.id === firstSlotId);
  const secondIndex = slots.findIndex((slot) => slot.id === secondSlotId);

  if (firstIndex === -1 || secondIndex === -1) {
    return null;
  }

  const startIndex = Math.min(firstIndex, secondIndex);
  const endIndex = Math.max(firstIndex, secondIndex);

  return slots.slice(startIndex, endIndex + 1).map((slot) => slot.id);
}

export function App() {
  const slots = useMemo(() => createTimeSlots(), []);
  const savedState = useMemo(() => loadSavedState(), []);
  const isMiniView = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return new URLSearchParams(window.location.search).get('view') === 'mini';
  }, []);
  const initialSelectedSlotId = savedState?.selectedSlotId ?? slots[16].id;
  const [currentDate, setCurrentDate] = useState(() =>
    savedState ? new Date(savedState.currentDate) : new Date(),
  );
  const [dayPlan, setDayPlan] = useState<DayPlan>(() => savedState?.dayPlan ?? createEmptyDayPlan());
  const [selectedSlotId, setSelectedSlotId] = useState<string>(() => initialSelectedSlotId);
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>(() => [initialSelectedSlotId]);
  const [selectionAnchorSlotId, setSelectionAnchorSlotId] = useState<string>(
    () => initialSelectedSlotId,
  );
  const [now, setNow] = useState(() => new Date());

  const selectedSlot = dayPlan.slots.find((slot) => slot.id === selectedSlotId) ?? dayPlan.slots[0];
  const currentSlotId = getCurrentSlotId(now);
  const currentSlot = dayPlan.slots.find((slot) => slot.id === currentSlotId) ?? null;
  const isViewingToday = currentDate.toDateString() === now.toDateString();

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (isMiniView) {
      return;
    }

    saveState({
      version: STORAGE_VERSION,
      currentDate: currentDate.toISOString(),
      selectedSlotId,
      dayPlan,
    });
  }, [currentDate, dayPlan, isMiniView, selectedSlotId]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || event.newValue === null) {
        return;
      }

      try {
        const parsedValue: unknown = JSON.parse(event.newValue);
        if (!isValidSavedState(parsedValue)) {
          return;
        }

        setCurrentDate(new Date(parsedValue.currentDate));
        setSelectedSlotId(parsedValue.selectedSlotId);
        setSelectedSlotIds([parsedValue.selectedSlotId]);
        setSelectionAnchorSlotId(parsedValue.selectedSlotId);
        setDayPlan(parsedValue.dayPlan);
      } catch {
        // Ignore malformed external updates and keep the current window usable.
      }
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  function updateSelectedSlot(nextSlot: TimeSlot) {
    setDayPlan((previous) => ({
      ...previous,
      slots: previous.slots.map((slot) => (slot.id === nextSlot.id ? nextSlot : slot)),
    }));
  }

  function updateReview(review: string) {
    setDayPlan((previous) => ({
      ...previous,
      review,
    }));
  }

  function selectSlot(slotId: string, mode: SlotSelectionMode) {
    const hasSlot = dayPlan.slots.some((slot) => slot.id === slotId);

    if (!hasSlot) {
      return;
    }

    if (mode === 'replace') {
      setSelectedSlotId(slotId);
      setSelectedSlotIds([slotId]);
      setSelectionAnchorSlotId(slotId);
      return;
    }

    if (mode === 'range') {
      const anchorSlotId = dayPlan.slots.some((slot) => slot.id === selectionAnchorSlotId)
        ? selectionAnchorSlotId
        : selectedSlotId;
      const rangeSlotIds = getSlotRangeIds(dayPlan.slots, anchorSlotId, slotId);

      setSelectedSlotId(slotId);
      setSelectedSlotIds(rangeSlotIds ?? [slotId]);
      setSelectionAnchorSlotId(anchorSlotId);
      return;
    }

    const isAlreadySelected = selectedSlotIds.includes(slotId);
    const nextSelectedSlotIds =
      isAlreadySelected && selectedSlotIds.length > 1
        ? selectedSlotIds.filter((selectedSlotId) => selectedSlotId !== slotId)
        : getSortedValidSlotIds(dayPlan.slots, [...selectedSlotIds, slotId]);
    const nextFocusedSlotId = nextSelectedSlotIds.includes(slotId)
      ? slotId
      : nextSelectedSlotIds[0];

    setSelectedSlotId(nextFocusedSlotId);
    setSelectedSlotIds(nextSelectedSlotIds);
    setSelectionAnchorSlotId(nextFocusedSlotId);
  }

  function moveSelectedPlans(dragStartSlotId: string, insertIndex: number) {
    const sourceSlotIds = selectedSlotIds.includes(dragStartSlotId)
      ? selectedSlotIds
      : [dragStartSlotId];
    const moveResult = moveSelectedSlotPlans(dayPlan.slots, sourceSlotIds, insertIndex);

    if (!moveResult.didMove) {
      return;
    }

    setDayPlan((previous) => ({
      ...previous,
      slots: moveResult.slots,
    }));
    setSelectedSlotId(moveResult.movedSlotIds[0]);
    setSelectedSlotIds(moveResult.movedSlotIds);
    setSelectionAnchorSlotId(moveResult.movedSlotIds[0]);
  }

  function moveDate(offset: number) {
    setCurrentDate((previous) => {
      const next = new Date(previous);
      next.setDate(previous.getDate() + offset);
      return next;
    });
  }

  function goToday() {
    setCurrentDate(new Date());
  }

  function jumpToCurrentSlot() {
    setCurrentDate(new Date());
    setSelectedSlotId(currentSlotId);
    setSelectedSlotIds([currentSlotId]);
    setSelectionAnchorSlotId(currentSlotId);

    window.requestAnimationFrame(() => {
      document.querySelector(`[data-slot-id="${currentSlotId}"]`)?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
    });
  }

  async function openMiniWindow() {
    if (window.desktopBridge) {
      await window.desktopBridge.openMiniWindow();
      return;
    }

    const miniUrl = new URL(window.location.href);
    miniUrl.searchParams.set('view', 'mini');

    window.open(
      miniUrl.toString(),
      'time-manager-current-task',
      'popup=yes,width=380,height=520,left=980,top=80',
    );
  }

  if (isMiniView) {
    return (
      <main className="mini-shell">
        <CurrentTaskCard slot={currentSlot} now={now} isViewingToday={isViewingToday} compact />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <DayHeader
        date={currentDate}
        onPreviousDay={() => moveDate(-1)}
        onNextDay={() => moveDate(1)}
        onToday={goToday}
      />

      <section className="workspace">
        <TimeTable
          slots={slots}
          daySlots={dayPlan.slots}
          selectedSlotId={selectedSlot.id}
          selectedSlotIds={selectedSlotIds}
          currentSlotId={isViewingToday ? currentSlotId : null}
          onSelectSlot={selectSlot}
          onMoveSelectedPlans={moveSelectedPlans}
        />

        <aside className="side-panel">
          <CurrentTaskCard
            slot={currentSlot}
            now={now}
            isViewingToday={isViewingToday}
            onJumpToCurrent={jumpToCurrentSlot}
            onOpenMiniWindow={openMiniWindow}
          />
          <SlotEditor slot={selectedSlot} onChange={updateSelectedSlot} />
          <ReviewPanel value={dayPlan.review} onChange={updateReview} />
        </aside>
      </section>
    </main>
  );
}
