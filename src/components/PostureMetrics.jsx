import { memo, useMemo } from 'react';
import PropTypes from 'prop-types';

const PostureMetrics = memo(function PostureMetrics({ debugInfo, calibratedPose }) {
  const metrics = useMemo(() => {
    if (!debugInfo) return [];

    const items = [];
    const viewMode = calibratedPose?.viewMode || 'front';

    if (viewMode === 'side' || viewMode === 'diagonal') {
      // Neck forward position
      if (debugInfo.earNoseXDiff !== undefined) {
        const value = parseFloat(debugInfo.earNoseXDiff);
        const threshold = parseFloat(debugInfo.neckThreshold || 0.05);
        const normalized = Math.min(100, Math.abs(value) / threshold * 100);
        const status = Math.abs(value) > threshold ? 'bad' : Math.abs(value) > threshold * 0.7 ? 'warning' : 'good';
        items.push({
          label: '목 앞으로',
          value: `${(value * 100).toFixed(1)}%`,
          bar: normalized,
          status
        });
      }

      // Head drop
      if (debugInfo.headDrop !== undefined) {
        const value = parseFloat(debugInfo.headDrop);
        const threshold = parseFloat(debugInfo.headThreshold || 0.05);
        const normalized = Math.min(100, Math.abs(value) / threshold * 100);
        const status = Math.abs(value) > threshold ? 'bad' : Math.abs(value) > threshold * 0.7 ? 'warning' : 'good';
        items.push({
          label: '고개 숙임',
          value: `${(value * 100).toFixed(1)}%`,
          bar: normalized,
          status
        });
      }
    }

    // Shoulder tilt (for front/back/diagonal)
    if (debugInfo.shoulderTilt !== undefined) {
      const value = parseFloat(debugInfo.shoulderTilt);
      const threshold = parseFloat(debugInfo.tiltThreshold || 0.03);
      const normalized = Math.min(100, value / threshold * 100);
      const status = value > threshold ? 'bad' : value > threshold * 0.7 ? 'warning' : 'good';
      items.push({
        label: '어깨 기울기',
        value: `${(value * 100).toFixed(1)}%`,
        bar: normalized,
        status
      });
    }

    // Shoulder drop
    if (debugInfo.shoulderY !== undefined) {
      const value = parseFloat(debugInfo.shoulderY);
      const threshold = parseFloat(debugInfo.shoulderYThreshold || 0.05);
      const normalized = Math.min(100, Math.abs(value) / threshold * 100);
      const status = Math.abs(value) > threshold ? 'bad' : Math.abs(value) > threshold * 0.7 ? 'warning' : 'good';
      items.push({
        label: '어깨 높이',
        value: `${(value * 100).toFixed(1)}%`,
        bar: normalized,
        status
      });
    }

    return items;
  }, [debugInfo, calibratedPose]);

  if (metrics.length === 0) return null;

  return (
    <div className="posture-metrics">
      {metrics.map((metric, idx) => (
        <div key={idx} className="metric-item">
          <span className="metric-label">{metric.label}</span>
          <div className="metric-bar">
            <div
              className={`metric-bar-fill ${metric.status}`}
              style={{ width: `${metric.bar}%` }}
            />
          </div>
          <span className={`metric-value ${metric.status}`}>{metric.value}</span>
        </div>
      ))}
    </div>
  );
});

PostureMetrics.propTypes = {
  debugInfo: PropTypes.object,
  calibratedPose: PropTypes.shape({
    viewMode: PropTypes.string,
  }),
};

export default PostureMetrics;
