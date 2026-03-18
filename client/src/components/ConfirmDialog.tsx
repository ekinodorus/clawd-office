import { DqDialog } from './DqDialog';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  danger?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  danger,
}: ConfirmDialogProps) {
  return (
    <DqDialog open={open} onClose={onClose} width={380}>
      <div className="dq-dialog__title">{title}</div>
      <p className="dq-dialog__message">{message}</p>
      <div className="dq-dialog__actions">
        <button className="dq-dialog__btn dq-dialog__btn--secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className={`dq-dialog__btn ${danger ? 'dq-dialog__btn--danger' : 'dq-dialog__btn--primary'}`}
          onClick={onConfirm}
        >
          OK
        </button>
      </div>
    </DqDialog>
  );
}
