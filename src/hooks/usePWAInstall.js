import { useState, useEffect, useCallback } from 'react';

// 설치 상태 확인 함수
const checkInstalledStatus = () => {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS && window.navigator.standalone === true) return true;
  return false;
};

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(checkInstalledStatus);

  useEffect(() => {
    // 이미 설치된 경우 이벤트 리스너 등록 불필요
    if (isInstalled) return;

    // beforeinstallprompt 이벤트 캡처
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setIsInstallable(true);
    };

    // 앱 설치 완료 감지
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installPrompt) {
      return false;
    }

    try {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;

      if (outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
      }

      setInstallPrompt(null);
      return outcome === 'accepted';
    } catch (error) {
      console.error('Install prompt failed:', error);
      return false;
    }
  }, [installPrompt]);

  // iOS용 설치 안내
  const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const showIOSInstallGuide = isIOSDevice && !isInstalled;

  return {
    isInstallable,
    isInstalled,
    promptInstall,
    showIOSInstallGuide,
  };
}

export default usePWAInstall;
