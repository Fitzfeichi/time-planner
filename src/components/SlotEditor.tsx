import { useEffect, useRef } from 'react';
import { statusLabels, statusOptions } from '../lib/status';
import type { SlotStatus, TimeSlot } from '../types';

interface SlotEditorProps {
  slot: TimeSlot;
  planFocusRequestId: number;
  selectedSlotCount: number;
  canMergeSelectedSlots: boolean;
  canSplitMergedRange: boolean;
  onMergeSelectedSlots: () => void;
  onSplitMergedRange: () => void;
  onChange: (slot: TimeSlot) => void;
}

export function SlotEditor({
  slot,
  planFocusRequestId,
  selectedSlotCount,
  canMergeSelectedSlots,
  canSplitMergedRange,
  onMergeSelectedSlots,
  onSplitMergedRange,
  onChange,
}: SlotEditorProps) {
  const planInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (planFocusRequestId === 0) {
      return;
    }

    const planInput = planInputRef.current;

    if (planInput === null) {
      return;
    }

    const textEnd = planInput.value.length;
    planInput.focus();
    planInput.setSelectionRange(textEnd, textEnd);
  }, [planFocusRequestId]);

  function updateField(field: 'plan' | 'actual', value: string) {
    onChange({
      ...slot,
      [field]: value,
      status: field === 'plan' && slot.status === 'empty' && value.trim() ? 'planned' : slot.status,
    });
  }

  function updateStatus(status: SlotStatus) {
    onChange({
      ...slot,
      status,
    });
  }

  return (
    <section className="panel-block">
      <div className="panel-title">
        <p>当前时间格</p>
        <strong>
          {slot.start} - {slot.end}
        </strong>
      </div>

      {canSplitMergedRange || selectedSlotCount > 1 ? (
        <div className="merge-actions">
          {canSplitMergedRange ? (
            <button type="button" onClick={onSplitMergedRange}>
              拆分连续任务
            </button>
          ) : (
            <button
              type="button"
              className="primary-button"
              disabled={!canMergeSelectedSlots}
              onClick={onMergeSelectedSlots}
            >
              合并为连续任务
            </button>
          )}
          {!canSplitMergedRange && selectedSlotCount > 1 && !canMergeSelectedSlots ? (
            <p>只能合并连续、且尚未合并的时间格。</p>
          ) : null}
        </div>
      ) : null}

      <label className="field">
        <span>计划内容</span>
        <textarea
          ref={planInputRef}
          value={slot.plan}
          onChange={(event) => updateField('plan', event.target.value)}
          placeholder="例如：整理今天最重要的三件事"
          rows={4}
        />
      </label>

      <label className="field">
        <span>实际内容</span>
        <textarea
          value={slot.actual}
          onChange={(event) => updateField('actual', event.target.value)}
          placeholder="例如：实际完成了任务拆分和邮件回复"
          rows={4}
        />
      </label>

      <div className="field">
        <span>状态</span>
        <div className="status-control" role="radiogroup" aria-label="状态">
          {statusOptions.map((status) => (
            <button
              type="button"
              key={status}
              className={slot.status === status ? 'active' : ''}
              onClick={() => updateStatus(status)}
            >
              {statusLabels[status]}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
