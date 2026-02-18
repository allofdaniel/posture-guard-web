import { DEFAULT_SETTINGS } from '../constants';

const STORAGE_KEYS = {
  HISTORY: 'postureHistory',
  SETTINGS: 'postureSettings',
};

const safeToNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const safeDateString = (value) => {
  if (typeof value !== 'string') return null;
  if (Number.isNaN(Date.parse(value))) return null;
  return value;
};

const sanitizeIssueCount = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, count]) => typeof count === 'number' && Number.isFinite(count) && count >= 0)
      .map(([issue, count]) => [issue, Math.floor(count)])
  );
};

const sanitizeTimeline = (timeline) => {
  if (!Array.isArray(timeline)) return [];

  return timeline
    .map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;

      const status = typeof entry.status === 'string' ? entry.status : null;
      const time = safeToNumber(entry.time, null);

      if (!status || time === null) return null;

      const issues = Array.isArray(entry.issues)
        ? entry.issues.filter((issue) => typeof issue === 'string').slice(0, 8)
        : [];

      return {
        time,
        status,
        issues,
      };
    })
    .filter(Boolean);
};

// validate and merge only known settings
const validateSettings = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }

  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  for (const key of dangerousKeys) {
    if (key in data) {
      delete data[key];
    }
  }

  const validated = {};
  const allowedKeys = Object.keys(DEFAULT_SETTINGS);

  for (const key of allowedKeys) {
    if (key in data) {
      const value = data[key];
      const defaultValue = DEFAULT_SETTINGS[key];
      const expectedType = typeof defaultValue;

      if (typeof value === expectedType) {
        if (expectedType === 'number') {
          if (key === 'sensitivity' && (value < 0.5 || value > 2)) continue;
          if (key === 'alertDelay' && (value < 1 || value > 10)) continue;
          if (key === 'alertVolume' && (value < 0 || value > 1)) continue;
          if (key === 'dailyGoal' && (value < 0 || value > 100)) continue;
          if (key === 'breakInterval' && (value < 5 || value > 120)) continue;
        }

        if (key === 'theme' && !['dark', 'light'].includes(value)) continue;
        if (key === 'alertSound' && !['beep', 'bell', 'chime'].includes(value)) continue;

        validated[key] = value;
      }
    }
  }

  return Object.keys(validated).length > 0 ? validated : null;
};

// validate history entry shape and keep backwards-compatible fields
const validateHistoryEntry = (entry) => {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null;
  }

  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  for (const key of dangerousKeys) {
    if (key in entry) {
      return null;
    }
  }

  if (typeof entry.id !== 'number' || typeof entry.date !== 'string') {
    return null;
  }

  if (Number.isNaN(Date.parse(entry.date))) {
    return null;
  }

  const goodPercentage = safeToNumber(entry.goodPercentage ?? entry.score, 0);

  return {
    id: entry.id,
    date: entry.date,
    duration: safeToNumber(entry.duration, 0),
    goodTime: safeToNumber(entry.goodTime, 0),
    badTime: safeToNumber(entry.badTime, 0),
    alerts: safeToNumber(entry.alerts, 0),
    score: safeToNumber(entry.score ?? goodPercentage, 0),
    goodPercentage,
    viewMode: typeof entry.viewMode === 'string' ? entry.viewMode : 'front',
    issueCount: sanitizeIssueCount(entry.issueCount),
    timeline: sanitizeTimeline(entry.timeline),
    startTime: safeDateString(entry.startTime),
  };
};

const validateHistory = (data) => {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map(validateHistoryEntry)
    .filter(Boolean)
    .slice(0, 30);
};

export const loadHistory = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return validateHistory(parsed);
  } catch (e) {
    console.warn('History load failed:', e);
    return [];
  }
};

export const saveHistory = (history) => {
  try {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    return true;
  } catch (e) {
    console.warn('History save failed:', e);
    return false;
  }
};

export const addToHistory = (result, currentHistory) => {
  const newEntry = {
    id: Date.now(),
    date: new Date().toISOString(),
    ...result,
  };
  const updated = [newEntry, ...currentHistory].slice(0, 30);
  saveHistory(updated);
  return updated;
};

export const clearHistory = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
    return true;
  } catch (e) {
    console.warn('History clear failed:', e);
    return false;
  }
};

export const loadSettings = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return validateSettings(parsed);
  } catch (e) {
    console.warn('Settings load failed:', e);
    return null;
  }
};

export const saveSettings = (settings) => {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    return true;
  } catch (e) {
    console.warn('Settings save failed:', e);
    return false;
  }
};
