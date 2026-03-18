import { useState, useRef, useEffect } from 'react';

interface PromptInputProps {
  agentId: string;
  onSubmit: (prompt: string) => void;
  prefill?: string;
  onPrefillConsumed?: () => void;
  isWorking?: boolean;
  onAbort?: () => void;
}

export function PromptInput({ agentId, onSubmit, prefill, onPrefillConsumed, isWorking, onAbort }: PromptInputProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const lastPrefill = useRef<string>('');

  useEffect(() => {
    inputRef.current?.focus();
  }, [agentId]);

  useEffect(() => {
    if (prefill && prefill !== lastPrefill.current) {
      lastPrefill.current = prefill;
      setText(prefill);
      onPrefillConsumed?.();
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [prefill, onPrefillConsumed]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setText('');
  };

  return (
    <div className="prompt-input">
      <input
        ref={inputRef}
        className="prompt-input__field"
        type="text"
        placeholder={isWorking ? "Queue next prompt..." : "Send prompt..."}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
        }}
      />
      <button className="prompt-input__send" onClick={handleSubmit}>
        ▶
      </button>
      {isWorking && onAbort && (
        <button className="prompt-input__stop" onClick={onAbort} title="Stop execution">
          ■
        </button>
      )}
    </div>
  );
}
