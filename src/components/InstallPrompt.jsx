import { memo, useState } from 'react';
import PropTypes from 'prop-types';

const InstallPrompt = memo(function InstallPrompt({
  isInstallable,
  onInstall,
  showIOSGuide
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  // iOS 설치 안내
  if (showIOSGuide) {
    return (
      <div className="install-prompt ios">
        <div className="install-content">
          <span className="install-icon">📲</span>
          <div className="install-text">
            <strong>앱으로 설치하기</strong>
            <p>Safari에서 공유 버튼 → "홈 화면에 추가"를 눌러주세요</p>
          </div>
        </div>
        <button
          className="install-dismiss"
          onClick={() => setDismissed(true)}
          aria-label="닫기"
        >
          ✕
        </button>
      </div>
    );
  }

  // Android/Desktop 설치 프롬프트
  if (isInstallable) {
    return (
      <div className="install-prompt">
        <div className="install-content">
          <span className="install-icon">📲</span>
          <div className="install-text">
            <strong>앱으로 설치하기</strong>
            <p>더 빠르고 편리하게 사용하세요</p>
          </div>
        </div>
        <div className="install-buttons">
          <button className="install-btn" onClick={onInstall}>
            설치
          </button>
          <button
            className="install-dismiss"
            onClick={() => setDismissed(true)}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return null;
});

InstallPrompt.propTypes = {
  isInstallable: PropTypes.bool,
  onInstall: PropTypes.func,
  showIOSGuide: PropTypes.bool,
};

export default InstallPrompt;
