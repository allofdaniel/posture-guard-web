import { memo } from 'react';

const LoadingScreen = memo(function LoadingScreen({
  isLoading,
  loadingProgress,
  cameraError,
  onRetry
}) {
  return (
    <div className="app">
      <div className="loading-screen">
        {isLoading && !cameraError && (
          <>
            <div className="loading-spinner" aria-label="로딩 중"></div>
            <p>{loadingProgress}</p>
          </>
        )}
        {cameraError && (
          <>
            <div className="error-icon" aria-hidden="true">📷</div>
            <p className="error-message" role="alert">{cameraError}</p>
            <button className="retry-btn" onClick={onRetry}>
              다시 시도
            </button>
            <p className="error-hint">
              카메라 권한을 확인하고 다시 시도해주세요.
              <br />
              Android의 경우 앱 설정에서 카메라 권한을 허용해주세요.
            </p>
          </>
        )}
      </div>
    </div>
  );
});

export default LoadingScreen;
