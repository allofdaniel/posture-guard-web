// 카메라 권한 및 지원 확인
export const checkCameraSupport = async () => {
  // mediaDevices API 지원 확인
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return { supported: false, error: 'NOT_SUPPORTED', message: '이 브라우저는 카메라를 지원하지 않습니다.' };
  }

  // HTTPS 확인 (localhost 제외)
  const isSecure = window.location.protocol === 'https:' ||
                   window.location.hostname === 'localhost' ||
                   window.location.hostname === '127.0.0.1';
  if (!isSecure) {
    return { supported: false, error: 'NOT_SECURE', message: '카메라 사용을 위해 HTTPS 연결이 필요합니다.' };
  }

  // 권한 상태 확인 (지원하는 브라우저만)
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const permission = await navigator.permissions.query({ name: 'camera' });
      if (permission.state === 'denied') {
        return { supported: false, error: 'PERMISSION_DENIED', message: '카메라 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.' };
      }
    } catch {
      // permissions API 미지원 시 무시
    }
  }

  return { supported: true };
};

// 카메라 스트림 요청 (다양한 옵션 시도)
export const requestCameraStream = async () => {
  const constraints = [
    // 1순위: 이상적인 설정
    {
      video: {
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 }
      }
    },
    // 2순위: 단순 전면 카메라
    {
      video: {
        facingMode: 'user'
      }
    },
    // 3순위: 아무 카메라
    {
      video: true
    },
    // 4순위: 최소 해상도
    {
      video: {
        width: { min: 320 },
        height: { min: 240 }
      }
    }
  ];

  let lastError = null;

  for (const constraint of constraints) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraint);
      return { success: true, stream };
    } catch (err) {
      lastError = err;
      console.warn('카메라 옵션 시도 실패:', constraint, err.name);
    }
  }

  // 모든 시도 실패
  return { success: false, error: lastError };
};

// 카메라 에러 메시지 변환
export const getCameraErrorMessage = (error) => {
  if (!error) return '알 수 없는 오류가 발생했습니다.';

  switch (error.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return '카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return '카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.';
    case 'NotReadableError':
    case 'TrackStartError':
      return '카메라가 다른 앱에서 사용 중입니다. 다른 앱을 종료하고 다시 시도해주세요.';
    case 'OverconstrainedError':
      return '요청한 카메라 설정을 지원하지 않습니다.';
    case 'SecurityError':
      return '보안 오류: HTTPS 연결이 필요합니다.';
    case 'AbortError':
      return '카메라 접근이 중단되었습니다.';
    case 'TypeError':
      return '잘못된 카메라 설정입니다.';
    default:
      return `카메라 오류: ${error.message || error.name || '알 수 없는 오류'}`;
  }
};
