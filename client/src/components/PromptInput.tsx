import { useState, useRef, useEffect, useCallback } from 'react';
import type { SkillInfo } from '../types';

interface PromptInputProps {
  agentId: string;
  onSubmit: (prompt: string) => void;
  prefill?: string;
  onPrefillConsumed?: () => void;
  isWorking?: boolean;
  onAbort?: () => void;
  onListSkills?: (agentId: string) => Promise<{ skills: SkillInfo[] }>;
}

export function PromptInput({ agentId, onSubmit, prefill, onPrefillConsumed, isWorking, onAbort, onListSkills }: PromptInputProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const lastPrefill = useRef<string>('');

  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const skillsLoaded = useRef(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Load skills once when needed
  const loadSkills = useCallback(async () => {
    if (skillsLoaded.current || !onListSkills) return;
    try {
      const result = await onListSkills(agentId);
      setSkills(result.skills ?? []);
      skillsLoaded.current = true;
    } catch { /* ignore */ }
  }, [agentId, onListSkills]);

  // Reset skills cache when agent changes
  useEffect(() => {
    skillsLoaded.current = false;
    setSkills([]);
  }, [agentId]);

  // Filter skills based on current input after "/"
  const getSlashQuery = (): string | null => {
    if (!text.startsWith('/')) return null;
    return text.slice(1).toLowerCase();
  };

  const filteredSkills = (() => {
    const query = getSlashQuery();
    if (query === null) return [];
    if (query === '') return skills;
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.description.toLowerCase().includes(query)
    );
  })();

  const handleChange = (value: string) => {
    setText(value);
    if (value.startsWith('/')) {
      loadSkills();
      setShowDropdown(true);
      setSelectedIndex(0);
    } else {
      setShowDropdown(false);
    }
  };

  const selectSkill = (skill: SkillInfo) => {
    setText(`/${skill.name} `);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setShowDropdown(false);
    onSubmit(trimmed);
    setText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showDropdown && filteredSkills.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredSkills.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.nativeEvent.isComposing)) {
        e.preventDefault();
        selectSkill(filteredSkills[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowDropdown(false);
        return;
      }
    } else {
      if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSubmit();
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (!showDropdown || !dropdownRef.current) return;
    const item = dropdownRef.current.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, showDropdown]);

  return (
    <div className="prompt-input">
      <div className="prompt-input__wrapper">
        {showDropdown && filteredSkills.length > 0 && (
          <div className="prompt-input__dropdown" ref={dropdownRef}>
            {filteredSkills.map((skill, i) => (
              <div
                key={skill.name}
                className={`prompt-input__dropdown-item ${i === selectedIndex ? 'prompt-input__dropdown-item--selected' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); selectSkill(skill); }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="prompt-input__dropdown-name">/{skill.name}</span>
                <span className="prompt-input__dropdown-desc">{skill.description}</span>
              </div>
            ))}
          </div>
        )}
        <input
          ref={inputRef}
          className="prompt-input__field"
          type="text"
          placeholder={isWorking ? "Queue next prompt..." : "Send prompt... (type / for commands)"}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        />
      </div>
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
