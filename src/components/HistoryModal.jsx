import { memo } from 'react';
import Modal, { ModalHeader } from './Modal';
import { formatDuration, formatDate } from '../utils/format';

const HistoryModal = memo(function HistoryModal({
  isOpen,
  onClose,
  history,
  onClearHistory
}) {
  if (!isOpen) return null;

  const handleClear = () => {
    if (confirm('모든 기록을 삭제하시겠습니까?')) {
      onClearHistory();
    }
  };

  return (
    <Modal onClose={onClose} className="history-modal">
      <ModalHeader title="세션 기록" onClose={onClose} />

      <div className="history-list">
        {history.length === 0 ? (
          <p className="no-history">기록이 없습니다</p>
        ) : (
          history.map((session, idx) => (
            <div key={session.id || idx} className="history-item">
              <div className="history-date">
                {formatDate(session.date)}
              </div>
              <div className="history-stats">
                <span className={`history-score ${
                  session.goodPercentage >= 70 ? 'good' :
                  session.goodPercentage >= 50 ? 'warning' : 'bad'
                }`}>
                  {session.goodPercentage}%
                </span>
                <span className="history-duration">{formatDuration(session.duration)}</span>
              </div>
              {session.timeline && session.timeline.length > 0 && (
                <div className="history-timeline">
                  {session.timeline.slice(0, 20).map((entry, i) => (
                    <div key={i} className={`mini-segment ${entry.status}`} />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {history.length > 0 && (
        <button className="clear-history-btn" onClick={handleClear}>
          기록 삭제
        </button>
      )}
    </Modal>
  );
});

export default HistoryModal;
