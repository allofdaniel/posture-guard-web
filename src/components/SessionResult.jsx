import { memo } from 'react';
import PropTypes from 'prop-types';
import { formatTime, formatDuration, formatTimeOnly } from '../utils/format';

const SessionResult = memo(function SessionResult({
  result,
  onNewSession,
  onShowHistory
}) {
  if (!result) return null;

  const getFeedbackClass = () => {
    if (result.goodPercentage >= 70) return 'excellent';
    if (result.goodPercentage >= 50) return 'good';
    return 'needs-work';
  };

  const getFeedbackText = () => {
    if (result.goodPercentage >= 70) return '훌륭해요!';
    if (result.goodPercentage >= 50) return '괜찮아요!';
    return '더 노력해요!';
  };

  return (
    <div className="result-container compact">
      {/* 헤더 + 원형 그래프 한 줄 */}
      <div className="result-top">
        <div className="result-chart-small">
          <svg viewBox="0 0 100 100" className="circular-chart small" aria-hidden="true">
            <circle className="circle-bg" cx="50" cy="50" r="40" />
            <circle
              className="circle-progress"
              cx="50" cy="50" r="40"
              style={{
                strokeDasharray: `${result.goodPercentage * 2.51} 251`,
                stroke: result.goodPercentage >= 70 ? '#22C55E' :
                        result.goodPercentage >= 50 ? '#FBBF24' : '#EF4444'
              }}
            />
          </svg>
          <div className="chart-center small">
            <span className="chart-percentage">{result.goodPercentage}%</span>
          </div>
        </div>
        <div className="result-info">
          <h2>세션 완료</h2>
          <p className="result-duration">{formatDuration(result.duration)}</p>
          <div className={`result-feedback-inline ${getFeedbackClass()}`}>
            {getFeedbackText()}
          </div>
        </div>
      </div>

      {/* 기본 통계 - 가로 한 줄 */}
      <div className="result-stats-row">
        <div className="result-stat-mini good">
          <span className="stat-mini-value">{formatTime(result.goodTime)}</span>
          <span className="stat-mini-label">바른</span>
        </div>
        <div className="result-stat-mini bad">
          <span className="stat-mini-value">{formatTime(result.badTime)}</span>
          <span className="stat-mini-label">나쁜</span>
        </div>
        <div className="result-stat-mini alert">
          <span className="stat-mini-value">{result.alerts}</span>
          <span className="stat-mini-label">알림</span>
        </div>
      </div>

      {/* 이슈별 통계 - 컴팩트 */}
      {result.issueCount && Object.keys(result.issueCount).length > 0 && (
        <div className="issue-breakdown compact">
          <div className="issue-tags">
            {Object.entries(result.issueCount)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4)
              .map(([issue, count]) => (
                <span key={issue} className="issue-tag">
                  {issue} <b>{count}</b>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* 타임라인 바 */}
      {result.timeline && result.timeline.length > 0 && (
        <div className="timeline-section">
          <div className="timeline-header">
            <span className="timeline-title">자세 타임라인</span>
            <span className="timeline-time">
              {result.startTime && formatTimeOnly(result.startTime)}
              {' ~ '}
              {formatTimeOnly(result.timestamp)}
            </span>
          </div>
          <div className="timeline-bar" role="img" aria-label="자세 변화 타임라인">
            {result.timeline.map((entry, i) => (
              <div
                key={i}
                className={`timeline-segment ${entry.status}`}
                style={{ flex: 1 }}
                title={entry.issues.length > 0 ? entry.issues.join(', ') : '바른 자세'}
              />
            ))}
          </div>
          <div className="timeline-legend">
            <span className="legend-item good">바른</span>
            <span className="legend-item warning">주의</span>
            <span className="legend-item bad">나쁜</span>
          </div>
        </div>
      )}

      <div className="result-buttons">
        <button className="main-btn start" onClick={onNewSession}>
          다시 시작
        </button>
        <button className="main-btn secondary" onClick={onShowHistory}>
          기록 보기
        </button>
      </div>
    </div>
  );
});

SessionResult.propTypes = {
  result: PropTypes.shape({
    goodPercentage: PropTypes.number,
    goodTime: PropTypes.number,
    badTime: PropTypes.number,
    duration: PropTypes.number,
    alerts: PropTypes.number,
    issueCount: PropTypes.object,
    timeline: PropTypes.array,
    startTime: PropTypes.string,
    timestamp: PropTypes.string,
  }),
  onNewSession: PropTypes.func.isRequired,
  onShowHistory: PropTypes.func.isRequired,
};

export default SessionResult;
