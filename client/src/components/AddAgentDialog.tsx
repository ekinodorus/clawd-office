import { useState, useCallback } from 'react';
import { DqDialog } from './DqDialog';
import { AGENT_COLORS } from '../types';

interface AddAgentDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (config: { name: string; workDirectory?: string; color?: string }) => void;
}

export function AddAgentDialog({ open, onClose, onSubmit }: AddAgentDialogProps) {
  const [name, setName] = useState('');
  const [workDirectory, setWorkDirectory] = useState('');
  const [color, setColor] = useState(AGENT_COLORS[0]);

  const handleSubmit = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({
      name: trimmed,
      workDirectory: workDirectory.trim() || undefined,
      color,
    });
    setName('');
    setWorkDirectory('');
    setColor(AGENT_COLORS[0]);
  }, [name, workDirectory, color, onSubmit]);

  const handleClose = useCallback(() => {
    setName('');
    setWorkDirectory('');
    setColor(AGENT_COLORS[0]);
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleSubmit();
    },
    [handleSubmit],
  );

  return (
    <DqDialog open={open} onClose={handleClose} width={400}>
      <div className="dq-dialog__title">New Agent</div>

      <div className="dq-dialog__field-group">
        <label className="dq-dialog__label">Name *</label>
        <input
          className="dq-dialog__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Agent name"
          autoFocus
        />
      </div>

      <div className="dq-dialog__field-group">
        <label className="dq-dialog__label">Color</label>
        <div className="dq-dialog__color-picker">
          {AGENT_COLORS.map((c) => (
            <button
              key={c}
              className={`dq-dialog__color-swatch ${c === color ? 'dq-dialog__color-swatch--active' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              type="button"
            />
          ))}
        </div>
      </div>

      <div className="dq-dialog__field-group">
        <label className="dq-dialog__label">Work Directory</label>
        <div className="dq-dialog__input-row">
          <input
            className="dq-dialog__input"
            value={workDirectory}
            onChange={(e) => setWorkDirectory(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="C:\path\to\project (optional)"
          />
          <button
            className="dq-dialog__browse-btn"
            type="button"
            onClick={async () => {
              try {
                const res = await fetch('http://localhost:8000/api/browse-directory', { method: 'POST' });
                const data = await res.json();
                if (data.path) setWorkDirectory(data.path);
              } catch { /* dialog cancelled or server error */ }
            }}
            title="Browse folder"
          >
            📁
          </button>
        </div>
      </div>

      <div className="dq-dialog__actions">
        <button className="dq-dialog__btn dq-dialog__btn--secondary" onClick={handleClose}>
          Cancel
        </button>
        <button
          className="dq-dialog__btn dq-dialog__btn--primary"
          onClick={handleSubmit}
          disabled={!name.trim()}
        >
          OK
        </button>
      </div>
    </DqDialog>
  );
}
