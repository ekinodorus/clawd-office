import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddAgentDialog } from '../components/AddAgentDialog';
import { AGENT_COLORS } from '../types';

describe('AddAgentDialog', () => {
  it('renders nothing when open is false', () => {
    render(
      <AddAgentDialog open={false} onClose={() => {}} onSubmit={() => {}} />,
    );
    expect(screen.queryByText('New Agent')).toBeNull();
  });

  it('renders title when open', () => {
    render(
      <AddAgentDialog open={true} onClose={() => {}} onSubmit={() => {}} />,
    );
    expect(screen.getByText('New Agent')).toBeTruthy();
  });

  it('renders name input with placeholder', () => {
    render(
      <AddAgentDialog open={true} onClose={() => {}} onSubmit={() => {}} />,
    );
    expect(screen.getByPlaceholderText('Agent name')).toBeTruthy();
  });

  it('renders OK button disabled when name is empty', () => {
    render(
      <AddAgentDialog open={true} onClose={() => {}} onSubmit={() => {}} />,
    );
    const okBtn = screen.getByText('OK') as HTMLButtonElement;
    expect(okBtn.disabled).toBe(true);
  });

  it('enables OK button when name is entered', () => {
    render(
      <AddAgentDialog open={true} onClose={() => {}} onSubmit={() => {}} />,
    );
    const input = screen.getByPlaceholderText('Agent name');
    fireEvent.change(input, { target: { value: 'MyAgent' } });
    const okBtn = screen.getByText('OK') as HTMLButtonElement;
    expect(okBtn.disabled).toBe(false);
  });

  it('does not submit when name is empty', () => {
    const onSubmit = vi.fn();
    render(
      <AddAgentDialog open={true} onClose={() => {}} onSubmit={onSubmit} />,
    );
    fireEvent.click(screen.getByText('OK'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with name when OK is clicked', () => {
    const onSubmit = vi.fn();
    render(
      <AddAgentDialog open={true} onClose={() => {}} onSubmit={onSubmit} />,
    );
    const input = screen.getByPlaceholderText('Agent name');
    fireEvent.change(input, { target: { value: 'TestCrab' } });
    fireEvent.click(screen.getByText('OK'));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'TestCrab' }),
    );
  });

  it('trims name before submitting', () => {
    const onSubmit = vi.fn();
    render(
      <AddAgentDialog open={true} onClose={() => {}} onSubmit={onSubmit} />,
    );
    const input = screen.getByPlaceholderText('Agent name');
    fireEvent.change(input, { target: { value: '  Trimmed  ' } });
    fireEvent.click(screen.getByText('OK'));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Trimmed' }),
    );
  });

  it('submits with Enter key in name field', () => {
    const onSubmit = vi.fn();
    render(
      <AddAgentDialog open={true} onClose={() => {}} onSubmit={onSubmit} />,
    );
    const input = screen.getByPlaceholderText('Agent name');
    fireEvent.change(input, { target: { value: 'EnterAgent' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'EnterAgent' }),
    );
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(
      <AddAgentDialog open={true} onClose={onClose} onSubmit={() => {}} />,
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders color swatches', () => {
    const { container } = render(
      <AddAgentDialog open={true} onClose={() => {}} onSubmit={() => {}} />,
    );
    // The dialog is portalled to body, query from document
    const swatches = document.body.querySelectorAll('.dq-dialog__color-swatch');
    expect(swatches.length).toBe(AGENT_COLORS.length);
  });

  it('includes selected color in submit payload', () => {
    const onSubmit = vi.fn();
    render(
      <AddAgentDialog open={true} onClose={() => {}} onSubmit={onSubmit} />,
    );
    const input = screen.getByPlaceholderText('Agent name');
    fireEvent.change(input, { target: { value: 'ColorAgent' } });
    // Click the second color swatch
    const swatches = document.body.querySelectorAll('.dq-dialog__color-swatch');
    fireEvent.click(swatches[1]);
    fireEvent.click(screen.getByText('OK'));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ColorAgent', color: AGENT_COLORS[1] }),
    );
  });

  it('defaults color to first AGENT_COLOR', () => {
    const onSubmit = vi.fn();
    render(
      <AddAgentDialog open={true} onClose={() => {}} onSubmit={onSubmit} />,
    );
    const input = screen.getByPlaceholderText('Agent name');
    fireEvent.change(input, { target: { value: 'DefaultColor' } });
    fireEvent.click(screen.getByText('OK'));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ color: AGENT_COLORS[0] }),
    );
  });
});
