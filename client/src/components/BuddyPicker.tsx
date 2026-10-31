import { useState, useEffect } from 'react';
import { BUDDY_SPECIES, BUDDY_BODIES, BUDDY_RARITIES, type BuddySpecies, type BuddyRarity } from '../pixi/buddySprites';
import { DqDialog } from './DqDialog';

interface BuddyPickerProps {
  open: boolean;
  current: BuddySpecies;
  currentRarity: BuddyRarity;
  onSelect: (species: BuddySpecies) => void;
  onRaritySelect: (rarity: BuddyRarity) => void;
  onClose: () => void;
}

function BuddyPreview({ species, selected, color }: { species: BuddySpecies; selected: boolean; color: string }) {
  const [frame, setFrame] = useState(0);
  const frames = BUDDY_BODIES[species];

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % frames.length);
    }, 500);
    return () => clearInterval(interval);
  }, [frames.length]);

  return (
    <div className={`buddy-picker__item ${selected ? 'buddy-picker__item--selected' : ''}`}>
      <pre className="buddy-picker__sprite" style={{ color }}>{frames[frame].join('\n')}</pre>
      <span className="buddy-picker__name">{species}</span>
    </div>
  );
}

export function BuddyPicker({ open, current, currentRarity, onSelect, onRaritySelect, onClose }: BuddyPickerProps) {
  const rarityColor = BUDDY_RARITIES.find((r) => r.name === currentRarity)?.color ?? '#50c878';

  return (
    <DqDialog open={open} onClose={onClose}>
      <div className="buddy-picker">
        <div className="buddy-picker__title">/buddy</div>

        {/* Rarity selector */}
        <div className="buddy-picker__rarity-row">
          {BUDDY_RARITIES.map((r) => (
            <button
              key={r.name}
              className={`buddy-picker__rarity-btn ${r.name === currentRarity ? 'buddy-picker__rarity-btn--selected' : ''}`}
              style={{ color: r.color, borderColor: r.name === currentRarity ? r.color : 'transparent' }}
              onClick={() => onRaritySelect(r.name)}
            >
              {r.name}
            </button>
          ))}
        </div>

        {/* Species grid */}
        <div className="buddy-picker__grid">
          {BUDDY_SPECIES.map((species) => (
            <div key={species} onClick={() => onSelect(species)}>
              <BuddyPreview species={species} selected={species === current} color={rarityColor} />
            </div>
          ))}
        </div>
      </div>
    </DqDialog>
  );
}
