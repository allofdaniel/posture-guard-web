import { memo, useState, useEffect, useRef } from 'react';
import { VIEW_MODE_LABELS } from '../constants';

const getAngleEmoji = (angle) => {
  switch (angle) {
    case 'side': return '📐';
    case 'diagonal': return '↗️';
    case 'back': return '🔙';
    default: return '👤';
  }
};

const getAngleTip = (angle) => {
  switch (angle) {
    case 'side':
      return '측면 뷰에서는 목 앞으로 빠짐을 잘 감지합니다';
    case 'diagonal':
      return '대각선 뷰에서는 전반적인 자세를 감지합니다';
    case 'back':
      return '후면 뷰에서는 어깨 기울기를 감지합니다';
    default:
      return '정면 뷰에서는 어깨 균형과 고개 숙임을 감지합니다';
  }
};

const CALIBRATION_STEPS = [
  { icon: '🪑', title: '바른 자세', desc: '허리를 곧게 펴고 바르게 앉아주세요', check: '자세 준비' },
  { icon: '📱', title: '카메라 고정', desc: '카메라를 고정된 위치에 배치해주세요', check: '카메라 확인' },
  { icon: '👤', title: '화면 조정', desc: '상체가 가이드 안에 들어오도록 조정해주세요', check: '위치 확인' },
];

const CalibrationView = memo(function CalibrationView({
  canvasRef,
  cameraAngle,
  poseInGuide,
  onCalibrate
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [countdown, setCountdown] = useState(null);
  const prevPoseInGuide = useRef(poseInGuide);

  // Auto advance steps when pose is in guide
  useEffect(() => {
    if (poseInGuide && activeStep < CALIBRATION_STEPS.length - 1) {
      const timer = setTimeout(() => setActiveStep(prev => Math.min(prev + 1, CALIBRATION_STEPS.length - 1)), 1000);
      return () => clearTimeout(timer);
    }
  }, [poseInGuide, activeStep]);

  // Start countdown when ready - using ref to track previous state
  useEffect(() => {
    // Only set countdown when transitioning to final step while in guide
    if (poseInGuide && activeStep === CALIBRATION_STEPS.length - 1) {
      if (countdown === null) {
        // Use setTimeout to defer the state update
        const timer = setTimeout(() => setCountdown(3), 0);
        return () => clearTimeout(timer);
      }
    }
    // Reset when leaving guide
    if (!poseInGuide && prevPoseInGuide.current) {
      const timer = setTimeout(() => setCountdown(null), 0);
      return () => clearTimeout(timer);
    }
    prevPoseInGuide.current = poseInGuide;
  }, [poseInGuide, activeStep, countdown]);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleStartClick = () => {
    if (poseInGuide) {
      onCalibrate();
    }
  };

  return (
    <>
      <div className="camera-wrapper">
        <div className="camera-container calibration-mode">
          <canvas
            ref={canvasRef}
            className="camera-canvas"
            aria-label="자세 감지 카메라 화면"
            role="img"
          />

          {/* Camera angle badge with tip */}
          {cameraAngle && (
            <div className="calibration-view-badge">
              <span className="view-icon">{getAngleEmoji(cameraAngle)}</span>
              <span className="view-label">{VIEW_MODE_LABELS[cameraAngle]} 뷰</span>
            </div>
          )}

          {/* Status with countdown */}
          <div className={`calibration-status ${poseInGuide ? 'ready' : 'waiting'}`}>
            {poseInGuide ? (
              countdown !== null && countdown > 0 ? (
                <span className="countdown">{countdown}</span>
              ) : (
                '준비 완료!'
              )
            ) : (
              '가이드 안에 자세를 맞춰주세요'
            )}
          </div>

          {/* Progress indicator */}
          <div className="calibration-progress">
            {CALIBRATION_STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`progress-dot ${idx <= activeStep ? 'active' : ''} ${idx === activeStep ? 'current' : ''}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="calibration-panel">
        {/* Angle tip */}
        {cameraAngle && (
          <div className="angle-tip">
            <span className="tip-icon">💡</span>
            <span className="tip-text">{getAngleTip(cameraAngle)}</span>
          </div>
        )}

        {/* Step-by-step guide */}
        <div className="calibration-steps">
          {CALIBRATION_STEPS.map((step, idx) => (
            <div
              key={idx}
              className={`calibration-step ${idx === activeStep ? 'active' : ''} ${idx < activeStep ? 'completed' : ''}`}
            >
              <div className="step-icon">{idx < activeStep ? '✓' : step.icon}</div>
              <div className="step-content">
                <div className="step-title">{step.title}</div>
                <div className="step-desc">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <button
          className={`main-btn ${poseInGuide ? 'start glow' : 'disabled'}`}
          onClick={handleStartClick}
          disabled={!poseInGuide}
        >
          {poseInGuide ? (
            <>
              <span className="btn-icon">🎯</span>
              <span>이 자세로 시작하기</span>
            </>
          ) : (
            <>
              <span className="btn-icon">⏳</span>
              <span>자세 인식 대기 중...</span>
            </>
          )}
        </button>
      </div>
    </>
  );
});

export default CalibrationView;
