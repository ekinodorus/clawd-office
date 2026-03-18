import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from '../components/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders nothing when open is false', () => {
    render(
      <ConfirmDialog
        open={false}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Delete?"
        message="Are you sure?"
      />,
    );
    expect(screen.queryByText('Delete?')).toBeNull();
  });

  it('renders title when open', () => {
    render(
      <ConfirmDialog
        open={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Confirm Action"
        message="Proceed?"
      />,
    );
    expect(screen.getByText('Confirm Action')).toBeTruthy();
  });

  it('renders message when open', () => {
    render(
      <ConfirmDialog
        open={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Title"
        message="This is the message"
      />,
    );
    expect(screen.getByText('This is the message')).toBeTruthy();
  });

  it('renders Cancel and OK buttons', () => {
    render(
      <ConfirmDialog
        open={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Title"
        message="Msg"
      />,
    );
    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getByText('OK')).toBeTruthy();
  });

  it('calls onConfirm when OK is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onClose={() => {}}
        onConfirm={onConfirm}
        title="Title"
        message="Msg"
      />,
    );
    fireEvent.click(screen.getByText('OK'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onClose={onClose}
        onConfirm={() => {}}
        title="Title"
        message="Msg"
      />,
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('applies danger class when danger prop is true', () => {
    render(
      <ConfirmDialog
        open={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Title"
        message="Msg"
        danger={true}
      />,
    );
    const okBtn = screen.getByText('OK');
    expect(okBtn.classList.contains('dq-dialog__btn--danger')).toBe(true);
  });

  it('applies primary class when danger prop is false', () => {
    render(
      <ConfirmDialog
        open={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Title"
        message="Msg"
        danger={false}
      />,
    );
    const okBtn = screen.getByText('OK');
    expect(okBtn.classList.contains('dq-dialog__btn--primary')).toBe(true);
  });
});
