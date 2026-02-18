import { memo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';

const Modal = memo(function Modal({
  children,
  onClose,
  className = '',
  title = '',
}) {
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;

    const focusableElements = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusableElements?.length > 0) {
      focusableElements[0].focus();
    }

    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key === 'Tab') {
        const focusableElements = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusableElements?.length) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    const openModals = Number(document.body.dataset.modalCount || 0);
    document.body.dataset.modalCount = String(openModals + 1);
    document.body.classList.add('modal-open');
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      const nextCount = Math.max(0, Number(document.body.dataset.modalCount || 1) - 1);
      if (nextCount > 0) {
        document.body.dataset.modalCount = String(nextCount);
      } else {
        document.body.dataset.modalCount = '0';
        document.body.classList.remove('modal-open');
      }

      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        className={`modal ${className}`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
});

export const ModalHeader = memo(function ModalHeader({ title, onClose }) {
  return (
    <div className="modal-header">
      <h2 id="modal-title">{title}</h2>
      <button
        className="close-btn"
        onClick={onClose}
        aria-label="닫기"
      >
        ✕
      </button>
    </div>
  );
});

Modal.propTypes = {
  children: PropTypes.node.isRequired,
  onClose: PropTypes.func.isRequired,
  className: PropTypes.string,
  title: PropTypes.string,
};

ModalHeader.propTypes = {
  title: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default Modal;
