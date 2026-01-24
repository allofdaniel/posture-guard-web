import { memo, useMemo } from 'react';

const PostureScore = memo(function PostureScore({ status, debugInfo }) {
  // Calculate score based on current posture status and debug info
  const score = useMemo(() => {
    if (status === 'good') return 100;
    if (status === 'warning') return 70;

    // For bad status, calculate based on severity
    if (!debugInfo) return 30;

    let deductions = 0;

    // Check various metrics from debug info
    if (debugInfo.shoulderY !== undefined) {
      const deviation = Math.abs(parseFloat(debugInfo.shoulderY) - parseFloat(debugInfo.shoulderYThreshold || 0));
      deductions += Math.min(deviation * 100, 20);
    }

    if (debugInfo.shoulderTilt !== undefined) {
      const tilt = parseFloat(debugInfo.shoulderTilt);
      if (tilt > 0.03) deductions += 15;
    }

    if (debugInfo.headDrop !== undefined) {
      const drop = parseFloat(debugInfo.headDrop);
      if (drop > 0.05) deductions += 20;
    }

    if (debugInfo.earNoseXDiff !== undefined) {
      const neckBend = Math.abs(parseFloat(debugInfo.earNoseXDiff));
      if (neckBend > 0.05) deductions += 25;
    }

    return Math.max(10, Math.round(100 - deductions));
  }, [status, debugInfo]);

  const scoreClass = score >= 80 ? 'good' : score >= 50 ? 'warning' : 'bad';

  return (
    <div className="posture-score-container">
      <div className={`posture-score ${scoreClass}`}>
        <span className="score-value">{score}</span>
      </div>
      <span className="score-label">
        {score >= 80 ? '좋음' : score >= 50 ? '주의' : '교정필요'}
      </span>
    </div>
  );
});

export default PostureScore;
