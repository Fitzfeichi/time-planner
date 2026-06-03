import { useEffect, useMemo, useRef, useState } from 'react';
import { AppUpdatePanel } from './components/AppUpdatePanel';
import { CurrentTaskCard } from './components/CurrentTaskCard';
import { DayHeader } from './components/DayHeader';
import { ReviewPanel } from './components/ReviewPanel';
import { SlotEditor } from './components/SlotEditor';
import { TimeTable } from './components/TimeTable';
import {
  applyMergedRange,
  canCreateMergedRange,
  getMergedRangeForSlot,
  getMergedRangeSlotIds,
  hasMergedRangeConflict,
  removeMergedRangeForSlot,
} from './lib/mergedRanges';
import { isNightFoldSlot, shouldExpandNightFoldForSlots } from './lib/nightFold';
import { readMiniNeighborPreference } from './lib/miniNeighborPreference';
import { updateSlotPlanForDate } from './lib/planUpdates';
import { getSlotNeighbors } from './lib/slotNeighbors';
import { moveSelectedSlotPlans } from './lib/slotMoves';
import { getDesktopBridge } from './lib/desktopBridge';
import { createEmptyDayPlan, createTimeSlots, getCurrentSlotId } from './lib/timeSlots';
import type {
  DayPlan,
  MergedTimeRange,
  PersistedAppState,
  PlansByDate,
  SlotSelectionMode,
  SlotStatus,
  TimeSlot,
} from './types';

const STORAGE_KEY = 'time-manager-app-state';
const STORAGE_VERSION = 3;
const EXPECTED_SLOT_COUNT = 48;
const SLOT_STATUSES: SlotStatus[] = ['empty', 'planned', 'done', 'changed'];

interface LegacyPersistedAppState {
  version: number;
  currentDate: string;
  selectedSlotId: string;
  dayPlan: DayPlan;
}

interface PersistedAppStateV2 {
  version: 2;
  currentDate: string;
  selectedSlotId: string;
  plansByDate: PlansByDate;
  showMiniNeighborTasks?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function padDatePart(value: number) {
  return value.toString().padStart(2, '0');
}

function getDateKey(date: Date) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join('-');
}

function createDateFromKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

  if (match === null) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return getDateKey(date) === dateKey ? date : null;
}

function isValidDateKey(value: unknown): value is string {
  return typeof value === 'string' && createDateFromKey(value) !== null;
}

function getPreviousDateKey(date: Date) {
  const previousDate = new Date(date);
  previousDate.setDate(date.getDate() - 1);
  return getDateKey(previousDate);
}

function isValidSlotId(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('slot-')) {
    return false;
  }

  const slotIndex = Number(value.slice(5));
  return Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < EXPECTED_SLOT_COUNT;
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

function isValidMergedTimeRange(value: unknown): value is MergedTimeRange {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isValidSlotId(value.startSlotId) &&
    isValidSlotId(value.endSlotId)
  );
}

function isValidDayPlan(value: unknown): value is DayPlan {
  return (
    isRecord(value) &&
    typeof value.review === 'string' &&
    Array.isArray(value.slots) &&
    value.slots.length === EXPECTED_SLOT_COUNT &&
    value.slots.every(isValidTimeSlot) &&
    (value.mergedRanges === undefined ||
      (Array.isArray(value.mergedRanges) && value.mergedRanges.every(isValidMergedTimeRange)))
  );
}

function isValidPlansByDate(value: unknown): value is PlansByDate {
  return (
    isRecord(value) &&
    !Array.isArray(value) &&
    Object.entries(value).every(
      ([dateKey, dayPlan]) => isValidDateKey(dateKey) && isValidDayPlan(dayPlan),
    )
  );
}

function isValidSavedState(value: unknown): value is PersistedAppState {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.version === STORAGE_VERSION &&
    isValidDateKey(value.currentDate) &&
    isValidSlotId(value.selectedSlotId) &&
    isValidPlansByDate(value.plansByDate) &&
    (value.showMiniNeighborTasks === undefined || typeof value.showMiniNeighborTasks === 'boolean')
  );
}

function isValidSavedStateV2(value: unknown): value is PersistedAppStateV2 {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.version === 2 &&
    isValidDateKey(value.currentDate) &&
    isValidSlotId(value.selectedSlotId) &&
    isValidPlansByDate(value.plansByDate) &&
    (value.showMiniNeighborTasks === undefined || typeof value.showMiniNeighborTasks === 'boolean')
  );
}

function isValidLegacySavedState(value: unknown): value is LegacyPersistedAppState {
  if (!isRecord(value)) {
    return false;
  }

  if (
    value.version !== 1 ||
    typeof value.currentDate !== 'string' ||
    !isValidSlotId(value.selectedSlotId) ||
    !isValidDayPlan(value.dayPlan)
  ) {
    return false;
  }

  const savedDate = new Date(value.currentDate);
  const hasSelectedSlot = value.dayPlan.slots.some((slot) => slot.id === value.selectedSlotId);

  return !Number.isNaN(savedDate.getTime()) && hasSelectedSlot;
}

function normalizeDayPlan(dayPlan: DayPlan): DayPlan {
  return {
    ...dayPlan,
    mergedRanges: dayPlan.mergedRanges ?? [],
  };
}

function normalizePlansByDate(plansByDate: PlansByDate) {
  return Object.fromEntries(
    Object.entries(plansByDate).map(([dateKey, dayPlan]) => [
      dateKey,
      normalizeDayPlan(dayPlan),
    ]),
  );
}

function migrateSavedStateV2(state: PersistedAppStateV2): PersistedAppState {
  return {
    ...state,
    version: STORAGE_VERSION,
    plansByDate: normalizePlansByDate(state.plansByDate),
  };
}

function migrateLegacySavedState(state: LegacyPersistedAppState): PersistedAppState {
  const today = new Date();
  const todayKey = getDateKey(today);
  const previousDateKey = getPreviousDateKey(today);

  return {
    version: STORAGE_VERSION,
    currentDate: todayKey,
    selectedSlotId: state.selectedSlotId,
    plansByDate: {
      [previousDateKey]: normalizeDayPlan(state.dayPlan),
    },
    showMiniNeighborTasks: false,
  };
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
    if (isValidSavedState(parsedValue)) {
      return {
        ...parsedValue,
        plansByDate: normalizePlansByDate(parsedValue.plansByDate),
      };
    }

    if (isValidSavedStateV2(parsedValue)) {
      return migrateSavedStateV2(parsedValue);
    }

    if (isValidLegacySavedState(parsedValue)) {
      return migrateLegacySavedState(parsedValue);
    }

    return null;
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

function getPlanForDate(plansByDate: PlansByDate, dateKey: string) {
  return normalizeDayPlan(plansByDate[dateKey] ?? createEmptyDayPlan());
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

function getSlotWithRangeTime(
  slots: TimeSlot[],
  slot: TimeSlot | null,
  mergedRange: MergedTimeRange | null,
) {
  if (slot === null || mergedRange === null) {
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

export function App() {
  const slots = useMemo(() => createTimeSlots(), []);
  const savedState = useMemo(() => loadSavedState(), []);
  const initialNow = useMemo(() => new Date(), []);
  const isMiniView = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return new URLSearchParams(window.location.search).get('view') === 'mini';
  }, []);
  const initialDate = useMemo(() => {
    if (!isMiniView) {
      return initialNow;
    }

    if (savedState === null) {
      return initialNow;
    }

    return createDateFromKey(savedState.currentDate) ?? initialNow;
  }, [initialNow, isMiniView, savedState]);
  const desktopBridge = useMemo(() => getDesktopBridge(), []);
  const initialSelectedSlotId = isMiniView
    ? savedState?.selectedSlotId ?? slots[16].id
    : getCurrentSlotId(initialNow);
  const [currentDate, setCurrentDate] = useState(() => initialDate);
  const [plansByDate, setPlansByDate] = useState<PlansByDate>(
    () => savedState?.plansByDate ?? { [getDateKey(initialDate)]: createEmptyDayPlan() },
  );
  const [selectedSlotId, setSelectedSlotId] = useState<string>(() => initialSelectedSlotId);
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>(() => [initialSelectedSlotId]);
  const [selectionAnchorSlotId, setSelectionAnchorSlotId] = useState<string>(
    () => initialSelectedSlotId,
  );
  const [planFocusRequestId, setPlanFocusRequestId] = useState(0);
  const [now, setNow] = useState(() => initialNow);
  const [showMiniNeighborTasks, setShowMiniNeighborTasks] = useState(() =>
    readMiniNeighborPreference(savedState ?? {}),
  );
  const [isMiniAlwaysOnTop, setIsMiniAlwaysOnTop] = useState(false);
  const [isNightFoldManuallyExpanded, setIsNightFoldManuallyExpanded] = useState(
    () => !isMiniView && isNightFoldSlot(initialSelectedSlotId),
  );
  const hasAutoScrolledToCurrentSlot = useRef(false);

  const currentDateKey = getDateKey(currentDate);
  const todayDateKey = getDateKey(now);
  const dayPlan = getPlanForDate(plansByDate, currentDateKey);
  const todayPlan = getPlanForDate(plansByDate, todayDateKey);
  const selectedSlot = dayPlan.slots.find((slot) => slot.id === selectedSlotId) ?? dayPlan.slots[0];
  const currentSlotId = getCurrentSlotId(now);
  const currentSlotNeighbors = getSlotNeighbors(todayPlan.slots, currentSlotId);
  const selectedMergedRange = getMergedRangeForSlot(
    dayPlan.slots,
    dayPlan.mergedRanges,
    selectedSlot.id,
  );
  const selectedEditorSlot =
    getSlotWithRangeTime(dayPlan.slots, selectedSlot, selectedMergedRange) ?? selectedSlot;
  const currentMergedRange = getMergedRangeForSlot(
    todayPlan.slots,
    todayPlan.mergedRanges,
    currentSlotId,
  );
  const currentSlot = getSlotWithRangeTime(
    todayPlan.slots,
    currentSlotNeighbors.current,
    currentMergedRange,
  );
  const currentVisibleSlotId = currentMergedRange?.startSlotId ?? currentSlotId;
  const isViewingToday = currentDateKey === todayDateKey;
  const isNightFoldExpanded =
    isNightFoldManuallyExpanded || shouldExpandNightFoldForSlots(dayPlan.slots);
  const canMergeSelectedSlots = canCreateMergedRange(
    dayPlan.slots,
    dayPlan.mergedRanges,
    selectedSlotIds,
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!isMiniView) {
      return;
    }

    document.body.classList.add('mini-mode');

    return () => {
      document.body.classList.remove('mini-mode');
    };
  }, [isMiniView]);

  useEffect(() => {
    if (isNightFoldExpanded || !isNightFoldSlot(selectedSlotId)) {
      return;
    }

    const firstVisibleWorkSlotId = slots[16].id;
    setSelectedSlotId(firstVisibleWorkSlotId);
    setSelectedSlotIds([firstVisibleWorkSlotId]);
    setSelectionAnchorSlotId(firstVisibleWorkSlotId);
  }, [isNightFoldExpanded, selectedSlotId, slots]);

  useEffect(() => {
    if (isMiniView || hasAutoScrolledToCurrentSlot.current) {
      return;
    }

    if (isNightFoldSlot(currentSlotId) && !isNightFoldExpanded) {
      setIsNightFoldManuallyExpanded(true);
      return;
    }

    hasAutoScrolledToCurrentSlot.current = true;

    window.requestAnimationFrame(() => {
      document.querySelector(`[data-slot-id="${currentVisibleSlotId}"]`)?.scrollIntoView({
        block: 'center',
        behavior: 'auto',
      });
    });
  }, [currentSlotId, currentVisibleSlotId, isMiniView, isNightFoldExpanded]);

  useEffect(() => {
    setPlansByDate((previous) => {
      if (previous[currentDateKey]) {
        return previous;
      }

      return {
        ...previous,
        [currentDateKey]: createEmptyDayPlan(),
      };
    });
  }, [currentDateKey]);

  useEffect(() => {
    saveState({
      version: STORAGE_VERSION,
      currentDate: currentDateKey,
      selectedSlotId,
      plansByDate,
      showMiniNeighborTasks,
    });
  }, [currentDateKey, plansByDate, selectedSlotId, showMiniNeighborTasks]);

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

        const parsedCurrentDate = createDateFromKey(parsedValue.currentDate);
        if (parsedCurrentDate === null) {
          return;
        }

        setCurrentDate(parsedCurrentDate);
        setSelectedSlotId(parsedValue.selectedSlotId);
        setSelectedSlotIds([parsedValue.selectedSlotId]);
        setSelectionAnchorSlotId(parsedValue.selectedSlotId);
        setPlansByDate(parsedValue.plansByDate);
        setShowMiniNeighborTasks(readMiniNeighborPreference(parsedValue));
      } catch {
        // Ignore malformed external updates and keep the current window usable.
      }
    }

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  function updatePlanForCurrentDate(updater: (previous: DayPlan) => DayPlan) {
    setPlansByDate((previous) => {
      const previousDayPlan = getPlanForDate(previous, currentDateKey);

      return {
        ...previous,
        [currentDateKey]: updater(previousDayPlan),
      };
    });
  }

  function updateSelectedSlot(nextSlot: TimeSlot) {
    const mergedRange = getMergedRangeForSlot(dayPlan.slots, dayPlan.mergedRanges, nextSlot.id);
    const slotIdsToUpdate = new Set(
      mergedRange === null
        ? [nextSlot.id]
        : getMergedRangeSlotIds(dayPlan.slots, mergedRange),
    );

    updatePlanForCurrentDate((previous) => ({
      ...previous,
      slots: previous.slots.map((slot) =>
        slotIdsToUpdate.has(slot.id)
          ? {
              ...slot,
              plan: nextSlot.plan,
              actual: nextSlot.actual,
              status: nextSlot.status,
            }
          : slot,
      ),
    }));
  }

  function updateReview(review: string) {
    updatePlanForCurrentDate((previous) => ({
      ...previous,
      review,
    }));
  }

  function updateCurrentSlotPlan(plan: string) {
    setPlansByDate((previous) =>
      updateSlotPlanForDate(previous, todayDateKey, currentSlotId, plan),
    );
  }

  function toggleMiniNeighborTasks() {
    setShowMiniNeighborTasks((previous) => !previous);
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

  function editSlotPlan(slotId: string) {
    selectSlot(slotId, 'replace');
    setPlanFocusRequestId((previous) => previous + 1);
  }

  function moveSelectedPlans(dragStartSlotId: string, insertIndex: number) {
    const hasMergedSelection =
      getMergedRangeForSlot(dayPlan.slots, dayPlan.mergedRanges, dragStartSlotId) !== null ||
      selectedSlotIds.some(
        (slotId) => getMergedRangeForSlot(dayPlan.slots, dayPlan.mergedRanges, slotId) !== null,
      );

    if (hasMergedSelection) {
      return;
    }

    const sourceSlotIds = selectedSlotIds.includes(dragStartSlotId)
      ? selectedSlotIds
      : [dragStartSlotId];
    const moveResult = moveSelectedSlotPlans(dayPlan.slots, sourceSlotIds, insertIndex);

    if (!moveResult.didMove) {
      return;
    }

    updatePlanForCurrentDate((previous) => ({
      ...previous,
      slots: moveResult.slots,
    }));
    setSelectedSlotId(moveResult.movedSlotIds[0]);
    setSelectedSlotIds(moveResult.movedSlotIds);
    setSelectionAnchorSlotId(moveResult.movedSlotIds[0]);
  }

  function mergeSelectedSlots() {
    if (!canMergeSelectedSlots) {
      return;
    }

    if (hasMergedRangeConflict(dayPlan.slots, selectedSlotIds, selectedSlotId)) {
      const shouldMerge = window.confirm(
        '这些时间格里已有不同内容。合并后会以当前右侧正在编辑的时间格为准，覆盖这一段的计划、实际和状态。确定继续吗？',
      );

      if (!shouldMerge) {
        return;
      }
    }

    const mergeResult = applyMergedRange(
      dayPlan.slots,
      dayPlan.mergedRanges,
      selectedSlotIds,
      selectedSlotId,
    );

    if (!mergeResult.didMerge) {
      return;
    }

    updatePlanForCurrentDate((previous) => ({
      ...previous,
      slots: mergeResult.slots,
      mergedRanges: mergeResult.mergedRanges,
    }));
    setSelectedSlotIds(getMergedRangeSlotIds(mergeResult.slots, mergeResult.mergedRanges.at(-1)!));
  }

  function splitSelectedMergedRange() {
    if (selectedMergedRange === null) {
      return;
    }

    updatePlanForCurrentDate((previous) => ({
      ...previous,
      mergedRanges: removeMergedRangeForSlot(previous.mergedRanges, selectedSlotId),
    }));
    setSelectedSlotIds([selectedSlotId]);
    setSelectionAnchorSlotId(selectedSlotId);
  }

  function moveDate(offset: number) {
    setIsNightFoldManuallyExpanded(false);
    setCurrentDate((previous) => {
      const next = new Date(previous);
      next.setDate(previous.getDate() + offset);
      return next;
    });
  }

  function goToday() {
    setIsNightFoldManuallyExpanded(false);
    setCurrentDate(new Date());
  }

  function jumpToCurrentSlot() {
    setCurrentDate(new Date());
    setSelectedSlotId(currentSlotId);
    setSelectedSlotIds([currentSlotId]);
    setSelectionAnchorSlotId(currentSlotId);

    if (isNightFoldSlot(currentSlotId)) {
      setIsNightFoldManuallyExpanded(true);
    }

    window.requestAnimationFrame(() => {
      document.querySelector(`[data-slot-id="${currentVisibleSlotId}"]`)?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
    });
  }

  async function openMiniWindow() {
    if (desktopBridge) {
      await desktopBridge.openMiniWindow();
      return;
    }

    const miniUrl = new URL(window.location.href);
    miniUrl.searchParams.set('view', 'mini');

    window.open(
      miniUrl.toString(),
      'time-manager-current-task',
      'popup=yes,width=260,height=230,left=980,top=80',
    );
  }

  async function openMainWindow() {
    if (desktopBridge) {
      await desktopBridge.openMainWindow();
      return;
    }

    const mainUrl = new URL(window.location.href);
    mainUrl.searchParams.delete('view');

    const openedWindow = window.open(
      mainUrl.toString(),
      'time-manager-main',
      'popup=yes,width=1180,height=760,left=80,top=60',
    );

    if (openedWindow === null) {
      window.location.href = mainUrl.toString();
    }
  }

  async function toggleMiniAlwaysOnTop() {
    const nextAlwaysOnTop = !isMiniAlwaysOnTop;

    if (!desktopBridge?.setMiniAlwaysOnTop) {
      return;
    }

    const appliedAlwaysOnTop = await desktopBridge.setMiniAlwaysOnTop(nextAlwaysOnTop);
    setIsMiniAlwaysOnTop(appliedAlwaysOnTop);
  }

  async function minimizeMiniWindow() {
    await desktopBridge?.minimizeMiniWindow();
  }

  async function closeMiniWindow() {
    await desktopBridge?.closeMiniWindow();
  }

  if (isMiniView) {
    const canSetMiniAlwaysOnTop = Boolean(desktopBridge?.setMiniAlwaysOnTop);

    return (
      <main className="mini-shell">
        <div className="mini-titlebar">
          <button
            type="button"
            className="mini-title-button mini-back-button"
            aria-label="打开大窗口"
            title="打开大窗口"
            onClick={openMainWindow}
          >
            <span className="mini-back-icon" aria-hidden="true" />
          </button>
          <div className="mini-title-actions">
            {canSetMiniAlwaysOnTop ? (
              <button
                type="button"
                className={`mini-title-button mini-pin-button${isMiniAlwaysOnTop ? ' active' : ''}`}
                aria-label={isMiniAlwaysOnTop ? '取消置顶' : '置顶小窗'}
                aria-pressed={isMiniAlwaysOnTop}
                title={isMiniAlwaysOnTop ? '取消置顶' : '置顶小窗'}
                onClick={toggleMiniAlwaysOnTop}
              >
                <svg
                  className="mini-pin-icon"
                  viewBox="0 0 487 691"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="34"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M 337 41 L 296 27 L 263 21 L 217 23 L 203 27 L 179 41 L 167 55 L 160 70 L 157 84 L 157 100 L 160 115 L 168 135 L 182 157 L 197 175 L 136 283 L 90 294 L 63 308 L 38 330 L 25 351 L 20 368 L 20 380 L 27 394 L 62 423 L 121 460 L 62 654 L 61 666 L 67 671 L 76 669 L 184 491 L 242 513 L 290 525 L 312 524 L 320 520 L 332 508 L 345 478 L 347 445 L 339 410 L 328 385 L 319 372 L 370 255 L 408 252 L 434 242 L 454 225 L 463 209 L 467 193 L 466 169 L 461 152 L 444 122 L 430 105 L 399 77 L 372 59 Z M 95 601 L 97 601 Z M 140 470 L 165 482 L 166 485 L 97 601 L 96 598 L 137 471 Z M 211 188 L 249 215 L 285 234 L 318 246 L 350 254 L 301 367 L 302 379 L 318 407 L 328 443 L 328 467 L 325 481 L 316 498 L 304 507 L 288 506 L 256 498 L 215 484 L 166 463 L 128 443 L 86 417 L 51 391 L 40 380 L 38 375 L 39 367 L 46 351 L 56 338 L 70 326 L 98 311 L 124 304 L 139 303 L 148 298 Z M 182 66 L 194 53 L 208 45 L 226 40 L 258 39 L 296 46 L 327 57 L 352 69 L 374 82 L 401 103 L 421 123 L 435 142 L 444 160 L 449 181 L 448 195 L 443 208 L 434 219 L 419 229 L 404 234 L 382 237 L 346 234 L 322 228 L 274 208 L 226 176 L 202 152 L 189 134 L 180 116 L 175 95 L 176 81 Z"
                  />
                </svg>
              </button>
            ) : null}
            <button
              type="button"
              className="mini-title-button mini-minimize-button"
              aria-label="最小化小窗"
              title="最小化小窗"
              onClick={minimizeMiniWindow}
            >
              <span aria-hidden="true" />
            </button>
            <button
              type="button"
              className="mini-title-button mini-close-button"
              aria-label="关闭小窗"
              title="关闭小窗"
              onClick={closeMiniWindow}
            >
              <span aria-hidden="true" />
            </button>
          </div>
        </div>
        <CurrentTaskCard
          slot={currentSlot}
          previousSlot={currentSlotNeighbors.previous}
          nextSlot={currentSlotNeighbors.next}
          showMiniNeighborTasks={showMiniNeighborTasks}
          now={now}
          isViewingToday={true}
          compact
          onPlanChange={updateCurrentSlotPlan}
        />
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
          mergedRanges={dayPlan.mergedRanges}
          selectedSlotId={selectedSlot.id}
          selectedSlotIds={selectedSlotIds}
          currentSlotId={isViewingToday ? currentSlotId : null}
          isNightFoldExpanded={isNightFoldExpanded}
          onSelectSlot={selectSlot}
          onEditSlotPlan={editSlotPlan}
          onMoveSelectedPlans={moveSelectedPlans}
          onExpandNightFold={() => setIsNightFoldManuallyExpanded(true)}
        />

        <aside className="side-panel">
          <CurrentTaskCard
            slot={currentSlot}
            now={now}
            isViewingToday={isViewingToday}
            onJumpToCurrent={jumpToCurrentSlot}
            onOpenMiniWindow={openMiniWindow}
            showMiniNeighborTasks={showMiniNeighborTasks}
            onToggleMiniNeighborTasks={toggleMiniNeighborTasks}
          />
          <AppUpdatePanel />
          <SlotEditor
            slot={selectedEditorSlot}
            planFocusRequestId={planFocusRequestId}
            selectedSlotCount={selectedSlotIds.length}
            canMergeSelectedSlots={canMergeSelectedSlots}
            canSplitMergedRange={selectedMergedRange !== null}
            onMergeSelectedSlots={mergeSelectedSlots}
            onSplitMergedRange={splitSelectedMergedRange}
            onChange={updateSelectedSlot}
          />
          <ReviewPanel value={dayPlan.review} onChange={updateReview} />
        </aside>
      </section>
    </main>
  );
}
