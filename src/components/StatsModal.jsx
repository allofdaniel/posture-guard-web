import { memo } from 'react';
import Modal, { ModalHeader } from './Modal';

const StatsModal = memo(function StatsModal({
  isOpen,
  onClose,
  history,
  dailyGoal
}) {
  if (!isOpen) return null;

  const totalSessions = history.length;
  const avgScore = totalSessions > 0
    ? Math.round(history.reduce((sum, s) => sum + s.goodPercentage, 0) / totalSessions)
    : 0;

  // 최근 7일 통계
  const last7Days = history.slice(0, 7);

  return (
    <Modal onClose={onClose} className="stats-dashboard">
      <ModalHeader title="통계" onClose={onClose} />

      {/* 요약 카드 */}
      <div className="stats-summary">
        <div className="stats-card">
          <div className="stats-card-value">{totalSessions}</div>
          <div className="stats-card-label">총 세션</div>
        </div>
        <div className="stats-card">
          <div className={`stats-card-value ${
            avgScore >= 70 ? 'good' :
            avgScore >= 50 ? 'warning' : 'bad'
          }`}>
            {avgScore}%
          </div>
          <div className="stats-card-label">평균 점수</div>
        </div>
      </div>

      {/* 최근 7일 차트 */}
      {last7Days.length > 0 && (
        <div className="stats-chart">
          <div className="stats-chart-title">최근 세션</div>
          <div className="stats-bars">
            {last7Days.map((session, idx) => (
              <div key={session.id || idx} className="stats-bar-item">
                <div className="stats-bar" style={{ height: '80px' }}>
                  <div
                    className={`stats-bar-fill ${
                      session.goodPercentage >= 70 ? 'good' :
                      session.goodPercentage >= 50 ? 'warning' : 'bad'
                    }`}
                    style={{ height: `${session.goodPercentage}%` }}
                  />
                </div>
                <div className="stats-bar-label">{session.goodPercentage}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 목표 달성 */}
      <div className="stats-goal-progress">
        <div className="stats-goal-header">
          <span className="stats-goal-title">일일 목표</span>
          <span className="stats-goal-value">{dailyGoal}%</span>
        </div>
        <div className="stats-goal-bar">
          <div
            className="stats-goal-fill"
            style={{ width: `${Math.min(100, (avgScore / dailyGoal) * 100)}%` }}
          />
        </div>
      </div>

      <button className="modal-btn primary full" onClick={onClose}>
        닫기
      </button>
    </Modal>
  );
});

export default StatsModal;
