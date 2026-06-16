import { useEffect, useRef } from 'react';

export interface ConfirmDialogContent {
  title: string;
  message: string;
  details?: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'default' | 'warning';
}

interface ConfirmDialogProps {
  request: ConfirmDialogContent;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ request, onConfirm, onCancel }: ConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const dialogTitleId = 'confirm-dialog-title';
  const dialogDescriptionId = 'confirm-dialog-description';

  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, [request]);

  return (
    <div className="confirm-overlay" role="presentation">
      <section
        className={`confirm-dialog${request.tone === 'warning' ? ' warning' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        aria-describedby={dialogDescriptionId}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onCancel();
          }
        }}
      >
        <div className="confirm-dialog-body">
          <div className="confirm-dialog-heading">
            <span className="confirm-dialog-mark" aria-hidden="true">
              !
            </span>
            <h2 id={dialogTitleId}>{request.title}</h2>
          </div>
          <p id={dialogDescriptionId}>{request.message}</p>
          {request.details ? <p className="confirm-dialog-details">{request.details}</p> : null}
        </div>

        <div className="confirm-dialog-actions">
          <button type="button" ref={cancelButtonRef} onClick={onCancel}>
            {request.cancelLabel ?? '取消'}
          </button>
          <button type="button" className="primary-button" onClick={onConfirm}>
            {request.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
