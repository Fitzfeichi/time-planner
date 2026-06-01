import { useEffect, useRef } from 'react';
import { statusLabels, statusOptions } from '../lib/status';
import type { SlotStatus, TimeSlot } from '../types';

interface SlotEditorProps {
  slot: TimeSlot;
  planFocusRequestId: number;
  onChange: (slot: TimeSlot) => void;
}

export function SlotEditor({ slot, planFocusRequestId, onChange }: SlotEditorProps) {
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
