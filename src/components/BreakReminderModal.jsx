import { memo } from 'react';
import PropTypes from 'prop-types';
import Modal from './Modal';

const BreakReminderModal = memo(function BreakReminderModal({
  isOpen,
  onClose,
  breakInterval
}) {
  if (!isOpen) return null;

  return (
    <Modal onClose={onClose} className="break-reminder-modal" title="휴식 시간">
      <div className="break-icon" aria-hidden="true">☕</div>
      <h2>휴식 시간!</h2>
      <p className="break-message">
        {breakInterval}분 동안 열심히 하셨어요.<br />
        잠시 일어나서 스트레칭을 해보세요.
      </p>
      <div className="break-tip">
        💡 목을 좌우로 돌리고, 어깨를 으쓱해보세요
      </div>
      <button className="modal-btn primary full" onClick={onClose}>
        확인 (계속하기)
      </button>
    </Modal>
  );
});

BreakReminderModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  breakInterval: PropTypes.number,
};

export default BreakReminderModal;
