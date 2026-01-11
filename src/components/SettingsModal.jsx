import { memo } from 'react';
import Modal, { ModalHeader } from './Modal';

const SettingsModal = memo(function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSettingsChange
}) {
  if (!isOpen) return null;

  const {
    theme,
    alertSound,
    alertVolume,
    dailyGoal,
    breakInterval,
    sensitivity,
    alertDelay
  } = settings;

  const updateSetting = (key, value) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <Modal onClose={onClose} className="full-settings-modal">
      <ModalHeader title="설정" onClose={onClose} />

      {/* 테마 설정 */}
      <div className="settings-section">
        <div className="settings-section-title">🎨 테마</div>
        <div className="settings-row">
          <span className="settings-label">화면 모드</span>
          <div className="theme-btns">
            <button
              className={`theme-btn dark ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => updateSetting('theme', 'dark')}
            >
              🌙 다크
            </button>
            <button
              className={`theme-btn light ${theme === 'light' ? 'active' : ''}`}
              onClick={() => updateSetting('theme', 'light')}
            >
              ☀️ 라이트
            </button>
          </div>
        </div>
      </div>

      {/* 알림 설정 */}
      <div className="settings-section">
        <div className="settings-section-title">🔔 알림</div>
        <div className="settings-row">
          <span className="settings-label">알림음</span>
          <div className="sound-btns">
            {['beep', 'chime', 'bell'].map(sound => (
              <button
                key={sound}
                className={`sound-btn ${alertSound === sound ? 'active' : ''}`}
                onClick={() => updateSetting('alertSound', sound)}
              >
                {sound === 'beep' ? '📢 비프' : sound === 'chime' ? '🔔 차임' : '🛎️ 벨'}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row">
          <span className="settings-label">볼륨</span>
          <div className="volume-control">
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={alertVolume}
              onChange={(e) => updateSetting('alertVolume', parseFloat(e.target.value))}
              className="volume-slider"
              aria-label="알림 볼륨"
            />
            <span className="volume-value">{Math.round(alertVolume * 100)}%</span>
          </div>
        </div>
        <div className="settings-row">
          <span className="settings-label">알림 딜레이</span>
          <div className="sound-btns">
            {[2, 3, 5].map(d => (
              <button
                key={d}
                className={`sound-btn ${alertDelay === d ? 'active' : ''}`}
                onClick={() => updateSetting('alertDelay', d)}
              >
                {d}초
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 목표 설정 */}
      <div className="settings-section">
        <div className="settings-section-title">🎯 목표</div>
        <div className="settings-row">
          <span className="settings-label">일일 목표</span>
          <div className="goal-input">
            <input
              type="number"
              min="50"
              max="100"
              value={dailyGoal}
              onChange={(e) => updateSetting('dailyGoal', Math.min(100, Math.max(50, parseInt(e.target.value) || 80)))}
              aria-label="일일 목표 퍼센트"
            />
            <span>% 바른 자세</span>
          </div>
        </div>
      </div>

      {/* 휴식 설정 */}
      <div className="settings-section">
        <div className="settings-section-title">☕ 휴식 알림</div>
        <div className="settings-row">
          <span className="settings-label">알림 간격</span>
          <div className="break-btns">
            {[0, 20, 30, 45, 60].map(mins => (
              <button
                key={mins}
                className={`break-btn ${breakInterval === mins ? 'active' : ''}`}
                onClick={() => updateSetting('breakInterval', mins)}
              >
                {mins === 0 ? '끄기' : `${mins}분`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 감지 설정 */}
      <div className="settings-section">
        <div className="settings-section-title">📷 감지</div>
        <div className="settings-row">
          <span className="settings-label">민감도</span>
          <div className="volume-control">
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={sensitivity}
              onChange={(e) => updateSetting('sensitivity', parseFloat(e.target.value))}
              className="volume-slider"
              aria-label="감지 민감도"
            />
            <span className="volume-value">{sensitivity.toFixed(1)}</span>
          </div>
        </div>
      </div>

      <button className="modal-btn primary full" onClick={onClose}>
        닫기
      </button>
    </Modal>
  );
});

export default SettingsModal;
