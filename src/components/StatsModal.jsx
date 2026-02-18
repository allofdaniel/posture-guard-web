import { memo, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import Modal, { ModalHeader } from './Modal';

const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}분`;
  return `${seconds}초`;
};

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays < 7) return `${diffDays}일 전`;
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
};

const StatsModal = memo(function StatsModal({
  isOpen,
  onClose,
  history,
  dailyGoal
}) {
  const [viewMode, setViewMode] = useState('weekly'); // 'weekly' or 'daily'

  // Calculate statistics
  const stats = useMemo(() => {
    if (history.length === 0) {
      return {
        totalSessions: 0,
        avgScore: 0,
        totalTime: 0,
        bestScore: 0,
        streak: 0,
        improvement: 0,
        todaySessions: 0,
        weeklyData: [],
        dailyData: []
      };
    }

    const totalSessions = history.length;
    const avgScore = Math.round(history.reduce((sum, s) => sum + s.goodPercentage, 0) / totalSessions);
    const totalTime = history.reduce((sum, s) => sum + (s.duration || 0), 0);
    const bestScore = Math.max(...history.map(s => s.goodPercentage));

    // Today's sessions
    const today = new Date().toDateString();
    const todaySessions = history.filter(s => new Date(s.date || s.timestamp).toDateString() === today).length;

    // Calculate streak
    let streak = 0;
    const dateSet = new Set(history.map(s => new Date(s.date || s.timestamp).toDateString()));
    const checkDate = new Date();
    while (dateSet.has(checkDate.toDateString())) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Improvement (compare first half vs second half of sessions)
    let improvement = 0;
    if (history.length >= 4) {
      const half = Math.floor(history.length / 2);
      const recentAvg = history.slice(0, half).reduce((sum, s) => sum + s.goodPercentage, 0) / half;
      const olderAvg = history.slice(half).reduce((sum, s) => sum + s.goodPercentage, 0) / (history.length - half);
      improvement = Math.round(recentAvg - olderAvg);
    }

    // Weekly data (last 7 sessions)
    const weeklyData = history.slice(0, 7).map(s => ({
      score: s.goodPercentage,
      duration: s.duration || 0,
      date: s.date || s.timestamp,
      issues: Object.keys(s.issueCount || {}).length
    })).reverse();

    // Daily aggregated data (last 7 days)
    const dailyMap = new Map();
    history.forEach(s => {
      const dateKey = new Date(s.date || s.timestamp).toDateString();
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { scores: [], totalTime: 0 });
      }
      dailyMap.get(dateKey).scores.push(s.goodPercentage);
      dailyMap.get(dateKey).totalTime += s.duration || 0;
    });

    const dailyData = Array.from(dailyMap.entries())
      .slice(0, 7)
      .map(([date, data]) => ({
        date,
        avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
        sessions: data.scores.length,
        totalTime: data.totalTime
      }))
      .reverse();

    return {
      totalSessions,
      avgScore,
      totalTime,
      bestScore,
      streak,
      improvement,
      todaySessions,
      weeklyData,
      dailyData
    };
  }, [history]);

  const safeDailyGoal = Number.isFinite(dailyGoal) && dailyGoal > 0 ? dailyGoal : 0;
  const goalProgress = safeDailyGoal === 0
    ? 0
    : Math.max(0, Math.min(100, (stats.avgScore / safeDailyGoal) * 100));

  if (!isOpen) return null;

  const chartData = viewMode === 'weekly' ? stats.weeklyData : stats.dailyData;

  return (
    <Modal onClose={onClose} className="stats-dashboard" title="통계 대시보드">
      <ModalHeader title="통계 대시보드" onClose={onClose} />

      {/* Summary Cards */}
      <div className="stats-summary-grid">
        <div className="stats-card highlight">
          <div className="stats-card-icon">🎯</div>
          <div className="stats-card-content">
            <div className={`stats-card-value ${
              stats.avgScore >= 70 ? 'good' :
              stats.avgScore >= 50 ? 'warning' : 'bad'
            }`}>
              {stats.avgScore}%
            </div>
            <div className="stats-card-label">평균 점수</div>
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-card-icon">🏆</div>
          <div className="stats-card-content">
            <div className="stats-card-value good">{stats.bestScore}%</div>
            <div className="stats-card-label">최고 점수</div>
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-card-icon">⏱️</div>
          <div className="stats-card-content">
            <div className="stats-card-value">{formatDuration(stats.totalTime)}</div>
            <div className="stats-card-label">총 모니터링</div>
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-card-icon">🔥</div>
          <div className="stats-card-content">
            <div className="stats-card-value">{stats.streak}일</div>
            <div className="stats-card-label">연속 사용</div>
          </div>
        </div>
      </div>

      {/* Improvement indicator */}
      {stats.improvement !== 0 && (
        <div className={`improvement-badge ${stats.improvement > 0 ? 'positive' : 'negative'}`}>
          <span className="improvement-icon">{stats.improvement > 0 ? '📈' : '📉'}</span>
          <span className="improvement-text">
            {stats.improvement > 0 ? '+' : ''}{stats.improvement}%
            {stats.improvement > 0 ? ' 개선됨' : ' 하락'}
          </span>
        </div>
      )}

      {/* Chart View Toggle */}
      {chartData.length > 0 && (
        <>
          <div className="chart-header">
            <div className="chart-title">자세 추이</div>
            <div className="chart-toggle">
              <button
                className={`toggle-option ${viewMode === 'weekly' ? 'active' : ''}`}
                onClick={() => setViewMode('weekly')}
              >
                세션별
              </button>
              <button
                className={`toggle-option ${viewMode === 'daily' ? 'active' : ''}`}
                onClick={() => setViewMode('daily')}
              >
                일별
              </button>
            </div>
          </div>

          {/* Chart */}
          <div className="stats-chart-enhanced">
            <div className="chart-y-axis">
              <span>100%</span>
              <span>50%</span>
              <span>0%</span>
            </div>
            <div className="chart-content">
              <div className="chart-grid">
                <div className="grid-line" style={{ bottom: '100%' }} />
                <div className="grid-line target" style={{ bottom: `${dailyGoal}%` }} />
                <div className="grid-line" style={{ bottom: '50%' }} />
                <div className="grid-line" style={{ bottom: '0%' }} />
              </div>
              <div className="chart-bars">
                {chartData.map((item, idx) => {
                  const score = viewMode === 'weekly' ? item.score : item.avgScore;
                  return (
                    <div key={idx} className="chart-bar-wrapper">
                      <div className="chart-bar-container">
                        <div
                          className={`chart-bar ${
                            score >= 70 ? 'good' :
                            score >= 50 ? 'warning' : 'bad'
                          }`}
                          style={{ height: `${score}%` }}
                        >
                          <span className="bar-value">{score}%</span>
                        </div>
                      </div>
                      <div className="chart-bar-label">
                        {viewMode === 'weekly'
                          ? formatDate(item.date)
                          : formatDate(item.date)
                        }
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Goal Progress */}
      <div className="stats-goal-section">
        <div className="stats-goal-header">
          <div className="goal-info">
            <span className="goal-icon">🎯</span>
            <span className="goal-title">일일 목표</span>
          </div>
          <span className="goal-value">{dailyGoal}%</span>
        </div>
        <div className="goal-progress-bar">
          <div
            className={`goal-progress-fill ${stats.avgScore >= dailyGoal ? 'achieved' : ''}`}
            style={{ width: `${goalProgress}%` }}
          />
          <div className="goal-marker" style={{ left: `${Math.max(0, Math.min(100, dailyGoal))}%` }} />
        </div>
        <div className="goal-status">
          {stats.avgScore >= dailyGoal
            ? '🎉 목표 달성!'
            : `${dailyGoal - stats.avgScore}% 더 필요`
          }
        </div>
      </div>

      {/* Session Summary */}
      <div className="session-summary">
        <div className="summary-item">
          <span className="summary-label">오늘 세션</span>
          <span className="summary-value">{stats.todaySessions}회</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">총 세션</span>
          <span className="summary-value">{stats.totalSessions}회</span>
        </div>
      </div>

      <button className="modal-btn primary full" onClick={onClose}>
        닫기
      </button>
    </Modal>
  );
});

StatsModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  history: PropTypes.array,
  dailyGoal: PropTypes.number,
};

export default StatsModal;
