import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DqDialog } from '../components/DqDialog';

describe('DqDialog', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(
      <DqDialog open={false} onClose={() => {}}>
        <p>Content</p>
      </DqDialog>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders children when open is true', () => {
    render(
      <DqDialog open={true} onClose={() => {}}>
        <p>Hello World</p>
      </DqDialog>,
    );
    expect(screen.getByText('Hello World')).toBeTruthy();
  });

  it('renders as a portal to document.body', () => {
    const { container } = render(
      <DqDialog open={true} onClose={() => {}}>
        <p>Portal Content</p>
      </DqDialog>,
    );
    // The content should NOT be inside the render container (it's portalled)
    expect(container.querySelector('.dq-dialog-backdrop')).toBeNull();
    // But it should be in document.body
    expect(document.body.querySelector('.dq-dialog-backdrop')).toBeTruthy();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <DqDialog open={true} onClose={onClose}>
        <p>Content</p>
      </DqDialog>,
    );
    const backdrop = document.body.querySelector('.dq-dialog-backdrop') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when dialog content is clicked', () => {
    const onClose = vi.fn();
    render(
      <DqDialog open={true} onClose={onClose}>
        <p>Content</p>
      </DqDialog>,
    );
    const dialog = document.body.querySelector('.dq-dialog') as HTMLElement;
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <DqDialog open={true} onClose={onClose}>
        <p>Content</p>
      </DqDialog>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose for non-Escape keys', () => {
    const onClose = vi.fn();
    render(
      <DqDialog open={true} onClose={onClose}>
        <p>Content</p>
      </DqDialog>,
    );
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('applies custom width style', () => {
    render(
      <DqDialog open={true} onClose={() => {}} width={500}>
        <p>Content</p>
      </DqDialog>,
    );
    const dialog = document.body.querySelector('.dq-dialog') as HTMLElement;
    expect(dialog.style.width).toBe('500px');
  });

  it('does not set width style when width prop is omitted', () => {
    render(
      <DqDialog open={true} onClose={() => {}}>
        <p>Content</p>
      </DqDialog>,
    );
    const dialog = document.body.querySelector('.dq-dialog') as HTMLElement;
    expect(dialog.style.width).toBe('');
  });
});
