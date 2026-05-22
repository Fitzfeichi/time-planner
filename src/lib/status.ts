import type { SlotStatus } from '../types';

export const statusLabels: Record<SlotStatus, string> = {
  empty: '空白',
  planned: '已计划',
  done: '完成',
  changed: '偏离计划',
};

export const statusOptions: SlotStatus[] = ['empty', 'planned', 'done', 'changed'];
