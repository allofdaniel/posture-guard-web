import { memo } from 'react';

const Modal = memo(function Modal({ children, onClose, className = '' }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${className}`} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
});

export const ModalHeader = memo(function ModalHeader({ title, onClose }) {
  return (
    <div className="modal-header">
      <h2>{title}</h2>
      <button className="close-btn" onClick={onClose} aria-label="닫기">✕</button>
    </div>
  );
});

export default Modal;
