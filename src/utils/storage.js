// 로컬 스토리지 유틸리티

const STORAGE_KEYS = {
  HISTORY: 'postureHistory',
  SETTINGS: 'postureSettings',
};

// 세션 히스토리 로드
export const loadHistory = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.HISTORY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.warn('History load failed:', e);
    return [];
  }
};

// 세션 히스토리 저장
export const saveHistory = (history) => {
  try {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    return true;
  } catch (e) {
    console.warn('History save failed:', e);
    return false;
  }
};

// 히스토리에 새 세션 추가
export const addToHistory = (result, currentHistory) => {
  const newEntry = {
    id: Date.now(),
    date: new Date().toISOString(),
    ...result,
  };
  const updated = [newEntry, ...currentHistory].slice(0, 30); // 최근 30개만 보관
  saveHistory(updated);
  return updated;
};

// 히스토리 삭제
export const clearHistory = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
    return true;
  } catch (e) {
    console.warn('History clear failed:', e);
    return false;
  }
};

// 설정 로드
export const loadSettings = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    console.warn('Settings load failed:', e);
    return null;
  }
};

// 설정 저장
export const saveSettings = (settings) => {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    return true;
  } catch (e) {
    console.warn('Settings save failed:', e);
    return false;
  }
};

// 기본 설정
export const DEFAULT_SETTINGS = {
  theme: 'dark',
  alertSound: 'beep',
  alertVolume: 0.5,
  dailyGoal: 80,
  breakInterval: 30,
  sensitivity: 1.0,
  alertDelay: 3,
  alertEnabled: true,
};
