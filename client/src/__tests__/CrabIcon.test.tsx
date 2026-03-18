import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CrabIcon } from '../components/CrabIcon';

describe('CrabIcon', () => {
  it('renders a canvas element', () => {
    const { container } = render(<CrabIcon color="#5b6ee1" />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
  });

  it('applies pixelated image rendering', () => {
    const { container } = render(<CrabIcon color="#d95763" />);
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.style.imageRendering).toBe('pixelated');
  });

  it('uses custom size', () => {
    const { container } = render(<CrabIcon color="#99e550" size={48} />);
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.style.width).toBe('48px');
  });

  it('defaults size to 24', () => {
    const { container } = render(<CrabIcon color="#5b6ee1" />);
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.style.width).toBe('24px');
  });
});
