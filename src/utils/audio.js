// 오디오 컨텍스트 싱글톤
let audioContext = null;

// 오디오 컨텍스트 초기화 (사용자 상호작용 시 호출)
export const initAudioContext = () => {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      console.log('AudioContext not supported');
    }
  }
  // 일시 중지 상태면 재개
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
};

// 비프음 재생
export const playBeep = () => {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const ctx = audioContext;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.log('Beep failed:', e);
  }
};

// 진동 (모바일)
export const vibrate = (pattern = [200, 100, 200]) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

// 브라우저 알림
export const showNotification = (title, options = {}) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        icon: '/favicon.ico',
        tag: 'posture-alert',
        renotify: true,
        silent: true,
        ...options,
      });
    } catch {
      // 모바일에서 Notification 실패 무시
    }
  }
};

// 알림 권한 요청
export const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    return Notification.requestPermission();
  }
  return Notification.permission;
};
