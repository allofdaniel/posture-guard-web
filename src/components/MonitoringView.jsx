import { memo, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { VIEW_MODE_LABELS } from '../constants';
import { formatTime } from '../utils/format';
import PostureScore from './PostureScore';
import PostureMetrics from './PostureMetrics';

const getAngleEmoji = (angle) => {
  switch (angle) {
    case 'side': return '📐';
    case 'diagonal': return '↗️';
    case 'back': return '🔙';
    default: return '👤';
  }
};

const getStatusInfo = (postureStatus) => {
  switch (postureStatus) {
    case 'bad':
      return { color: '#EF4444', text: '자세 교정 필요!', emoji: '😣', bgColor: 'rgba(239, 68, 68, 0.15)', statusClass: 'bad' };
    case 'warning':
      return { color: '#FBBF24', text: '주의', emoji: '😐', bgColor: 'rgba(251, 191, 36, 0.15)', statusClass: 'warning' };
    default:
      return { color: '#22C55E', text: '좋은 자세', emoji: '😊', bgColor: 'rgba(34, 197, 94, 0.15)', statusClass: 'good' };
  }
};


const MonitoringView = memo(function MonitoringView({
  canvasRef,
  postureStatus,
  postureIssues,
  calibratedPose,
  stats,
  showDebug,
  debugInfo,
  sensitivity,
  alertDelay,
  alertEnabled,
  onSensitivityChange,
  onAlertDelayChange,
  onAlertEnabledChange,
  onRecalibrate,
  onStop,
  onToggleDebug
}) {
  const statusInfo = useMemo(() => getStatusInfo(postureStatus), [postureStatus]);
  const formattedGoodTime = useMemo(() => formatTime(stats.goodTime), [stats.goodTime]);
  const formattedBadTime = useMemo(() => formatTime(stats.badTime), [stats.badTime]);

  const handleSensitivityChange = useCallback((e) => {
    onSensitivityChange(parseFloat(e.target.value));
  }, [onSensitivityChange]);

  // Session percentage
  const sessionPercentage = useMemo(() => {
    const total = stats.goodTime + stats.badTime;
    if (total === 0) return 100;
    return Math.round((stats.goodTime / total) * 100);
  }, [stats.goodTime, stats.badTime]);

  return (
    <>
      <div className="camera-wrapper">
        <div className={`camera-container status-${statusInfo.statusClass}`} style={{ borderColor: statusInfo.color }}>
          <canvas
            ref={canvasRef}
            className="camera-canvas"
            aria-label="자세 감지 카메라 화면"
            role="img"
          />

          {/* Posture Score - Center Top */}
          <PostureScore status={postureStatus} debugInfo={debugInfo} />

          {/* Status Indicator - Left */}
          <div className={`status-indicator ${statusInfo.statusClass}`}>
            <span className="status-emoji">{statusInfo.emoji}</span>
            <span className="status-text" style={{ color: statusInfo.color }}>
              {statusInfo.text}
            </span>
          </div>

          {/* Posture Metrics - Right (replaces debug when showDebug is true) */}
          {showDebug && debugInfo && (
            <PostureMetrics debugInfo={debugInfo} calibratedPose={calibratedPose} />
          )}

          {/* Issues - Bottom */}
          {postureIssues.length > 0 && (
            <div className="issues-container">
              {postureIssues.map((issue, i) => (
                <span key={i} className="issue-badge">{issue}</span>
              ))}
            </div>
          )}

          {/* Stats Overlay - Bottom Right */}
          <div className="camera-stats-overlay">
            <div className="overlay-stat session">
              <span className="overlay-value">{sessionPercentage}%</span>
              <span className="overlay-label">세션</span>
            </div>
            <div className="overlay-stat good">
              <span className="overlay-value">{formattedGoodTime}</span>
              <span className="overlay-label">바른</span>
            </div>
            <div className="overlay-stat bad">
              <span className="overlay-value">{formattedBadTime}</span>
              <span className="overlay-label">나쁜</span>
            </div>
            <div className="overlay-stat alert">
              <span className="overlay-value">{stats.alerts}</span>
              <span className="overlay-label">알림</span>
            </div>
          </div>

          {/* View Mode Badge */}
          <div className="view-mode-badge">
            {getAngleEmoji(calibratedPose?.viewMode)} {VIEW_MODE_LABELS[calibratedPose?.viewMode] || '정면'}
          </div>
        </div>
      </div>

      <div className="quick-controls compact">
        <div className="compact-settings">
          <div className="setting-row">
            <span className="setting-label">민감도</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={sensitivity}
              onChange={handleSensitivityChange}
              className="sensitivity-slider"
              aria-label="감지 민감도"
            />
            <span className="sensitivity-value">{sensitivity.toFixed(1)}</span>
          </div>
          <div className="setting-row">
            <span className="setting-label">알림</span>
            <div className="alert-controls">
              {[2, 3, 5].map(d => (
                <button
                  key={d}
                  className={`quick-btn small ${alertDelay === d ? 'active' : ''}`}
                  onClick={() => onAlertDelayChange(d)}
                >
                  {d}초
                </button>
              ))}
              <button
                className={`quick-btn small ${alertEnabled ? 'on' : 'off'}`}
                onClick={() => onAlertEnabledChange(!alertEnabled)}
              >
                {alertEnabled ? '켜짐' : '꺼짐'}
              </button>
            </div>
          </div>
        </div>

        <div className="action-buttons" role="group" aria-label="모니터링 제어">
          <button
            className="action-btn recalibrate"
            onClick={onRecalibrate}
            aria-label="기준 자세 재설정"
          >
            재설정
          </button>
          <button
            className="action-btn stop"
            onClick={onStop}
            aria-label="모니터링 중지"
          >
            중지
          </button>
          <button
            className={`action-btn debug ${showDebug ? 'active' : ''}`}
            onClick={onToggleDebug}
            title="수치 표시"
            aria-label={showDebug ? '디버그 정보 숨기기' : '디버그 정보 표시'}
            aria-pressed={showDebug}
          >
            {showDebug ? '📊' : '📈'}
          </button>
        </div>
      </div>
    </>
  );
});

MonitoringView.propTypes = {
  canvasRef: PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
  postureStatus: PropTypes.oneOf(['good', 'warning', 'bad']),
  postureIssues: PropTypes.arrayOf(PropTypes.string),
  calibratedPose: PropTypes.object,
  stats: PropTypes.shape({
    goodTime: PropTypes.number,
    badTime: PropTypes.number,
    alerts: PropTypes.number,
  }),
  showDebug: PropTypes.bool,
  debugInfo: PropTypes.object,
  sensitivity: PropTypes.number,
  alertDelay: PropTypes.number,
  alertEnabled: PropTypes.bool,
  onSensitivityChange: PropTypes.func.isRequired,
  onAlertDelayChange: PropTypes.func.isRequired,
  onAlertEnabledChange: PropTypes.func.isRequired,
  onRecalibrate: PropTypes.func.isRequired,
  onStop: PropTypes.func.isRequired,
  onToggleDebug: PropTypes.func.isRequired,
};

export default MonitoringView;
