import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Modal, { ModalHeader } from './Modal';

describe('Modal', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders children content', () => {
    render(
      <Modal onClose={() => {}}>
        <div>Test Content</div>
      </Modal>
    );
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose}>
        <div>Content</div>
      </Modal>
    );

    fireEvent.click(screen.getByRole('presentation'));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when modal content is clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose}>
        <div>Content</div>
      </Modal>
    );

    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose}>
        <div>Content</div>
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(
      <Modal onClose={() => {}} className="custom-modal">
        <div>Content</div>
      </Modal>
    );

    expect(screen.getByRole('dialog')).toHaveClass('modal', 'custom-modal');
  });

  it('has proper accessibility attributes', () => {
    render(
      <Modal onClose={() => {}} title="Test Title">
        <div>Content</div>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
  });

  it('focuses first focusable element on mount', () => {
    render(
      <Modal onClose={() => {}}>
        <button data-testid="first-btn">First</button>
        <button data-testid="second-btn">Second</button>
      </Modal>
    );

    expect(screen.getByTestId('first-btn')).toHaveFocus();
  });

  it('traps focus - Tab from last element goes to first', () => {
    render(
      <Modal onClose={() => {}}>
        <button data-testid="first-btn">First</button>
        <button data-testid="last-btn">Last</button>
      </Modal>
    );

    const lastBtn = screen.getByTestId('last-btn');
    lastBtn.focus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: false });
    expect(screen.getByTestId('first-btn')).toHaveFocus();
  });

  it('traps focus - Shift+Tab from first element goes to last', () => {
    render(
      <Modal onClose={() => {}}>
        <button data-testid="first-btn">First</button>
        <button data-testid="last-btn">Last</button>
      </Modal>
    );

    const firstBtn = screen.getByTestId('first-btn');
    firstBtn.focus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByTestId('last-btn')).toHaveFocus();
  });

  it('handles Tab key when there are focusable elements', () => {
    render(
      <Modal onClose={() => {}}>
        <input data-testid="input" />
        <button data-testid="btn">Button</button>
      </Modal>
    );

    const input = screen.getByTestId('input');
    input.focus();

    // Tab should not cause issues when not at boundary
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: false });
    // No error should occur
  });

  it('handles modal with no focusable elements', () => {
    render(
      <Modal onClose={() => {}}>
        <div>Static content only</div>
      </Modal>
    );

    // Tab should not cause errors when there are no focusable elements
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: false });
    // No error should occur
  });
});

describe('ModalHeader', () => {
  it('renders title', () => {
    render(
      <ModalHeader title="Test Title" onClose={() => {}} />
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <ModalHeader title="Test" onClose={onClose} />
    );

    fireEvent.click(screen.getByLabelText('닫기'));
    expect(onClose).toHaveBeenCalled();
  });

  it('close button has accessible label', () => {
    render(
      <ModalHeader title="Test" onClose={() => {}} />
    );

    expect(screen.getByLabelText('닫기')).toBeInTheDocument();
  });
});
