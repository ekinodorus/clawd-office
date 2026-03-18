import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PromptInput } from '../components/PromptInput';

describe('PromptInput', () => {
  it('renders an input field', () => {
    render(<PromptInput agentId="a-1" onSubmit={() => {}} />);
    const input = screen.getByPlaceholderText('Send prompt...');
    expect(input).toBeTruthy();
  });

  it('renders a send button', () => {
    const { container } = render(<PromptInput agentId="a-1" onSubmit={() => {}} />);
    const btn = container.querySelector('.prompt-input__send');
    expect(btn).toBeTruthy();
  });

  it('calls onSubmit with trimmed text when Enter is pressed', () => {
    const onSubmit = vi.fn();
    render(<PromptInput agentId="a-1" onSubmit={onSubmit} />);
    const input = screen.getByPlaceholderText('Send prompt...');
    fireEvent.change(input, { target: { value: '  hello world  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('hello world');
  });

  it('clears input after submit', () => {
    const onSubmit = vi.fn();
    render(<PromptInput agentId="a-1" onSubmit={onSubmit} />);
    const input = screen.getByPlaceholderText('Send prompt...') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe('');
  });

  it('does not submit when input is empty', () => {
    const onSubmit = vi.fn();
    render(<PromptInput agentId="a-1" onSubmit={onSubmit} />);
    const input = screen.getByPlaceholderText('Send prompt...');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not submit when input is only whitespace', () => {
    const onSubmit = vi.fn();
    render(<PromptInput agentId="a-1" onSubmit={onSubmit} />);
    const input = screen.getByPlaceholderText('Send prompt...');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit when send button is clicked', () => {
    const onSubmit = vi.fn();
    const { container } = render(<PromptInput agentId="a-1" onSubmit={onSubmit} />);
    const input = screen.getByPlaceholderText('Send prompt...');
    fireEvent.change(input, { target: { value: 'click submit' } });
    const btn = container.querySelector('.prompt-input__send') as HTMLElement;
    fireEvent.click(btn);
    expect(onSubmit).toHaveBeenCalledWith('click submit');
  });

  it('shows "Queue next prompt..." placeholder when isWorking', () => {
    render(<PromptInput agentId="a-1" onSubmit={() => {}} isWorking={true} />);
    expect(screen.getByPlaceholderText('Queue next prompt...')).toBeTruthy();
  });

  it('shows stop button when isWorking and onAbort provided', () => {
    const { container } = render(
      <PromptInput agentId="a-1" onSubmit={() => {}} isWorking={true} onAbort={() => {}} />,
    );
    const stopBtn = container.querySelector('.prompt-input__stop');
    expect(stopBtn).toBeTruthy();
  });

  it('does not show stop button when not working', () => {
    const { container } = render(
      <PromptInput agentId="a-1" onSubmit={() => {}} isWorking={false} onAbort={() => {}} />,
    );
    const stopBtn = container.querySelector('.prompt-input__stop');
    expect(stopBtn).toBeNull();
  });

  it('calls onAbort when stop button clicked', () => {
    const onAbort = vi.fn();
    const { container } = render(
      <PromptInput agentId="a-1" onSubmit={() => {}} isWorking={true} onAbort={onAbort} />,
    );
    const stopBtn = container.querySelector('.prompt-input__stop') as HTMLElement;
    fireEvent.click(stopBtn);
    expect(onAbort).toHaveBeenCalledTimes(1);
  });

  it('handles prefill text', () => {
    const onPrefillConsumed = vi.fn();
    render(
      <PromptInput
        agentId="a-1"
        onSubmit={() => {}}
        prefill="prefilled text"
        onPrefillConsumed={onPrefillConsumed}
      />,
    );
    const input = screen.getByDisplayValue('prefilled text') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(onPrefillConsumed).toHaveBeenCalled();
  });
});
