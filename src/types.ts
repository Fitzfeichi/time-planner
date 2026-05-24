export type SlotStatus = 'empty' | 'planned' | 'done' | 'changed';

export type SlotSelectionMode = 'replace' | 'toggle' | 'range';

export interface TimeSlot {
  id: string;
  start: string;
  end: string;
  plan: string;
  actual: string;
  status: SlotStatus;
}

export interface DayPlan {
  slots: TimeSlot[];
  review: string;
}

export type PlansByDate = Record<string, DayPlan>;

export interface PersistedAppState {
  version: number;
  currentDate: string;
  selectedSlotId: string;
  plansByDate: PlansByDate;
}
