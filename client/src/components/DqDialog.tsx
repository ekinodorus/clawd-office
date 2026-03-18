import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface DqDialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}

export function DqDialog({ open, onClose, children, width }: DqDialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  return createPortal(
    <div className="dq-dialog-backdrop" onClick={onClose}>
      <div
        className="dq-dialog"
        style={width ? { width } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
