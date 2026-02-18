import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { loadSettings, saveSettings } from '../utils/storage';
import { DEFAULT_SETTINGS } from '../constants';

// Debounce delay for localStorage writes (ms)
const SAVE_DEBOUNCE_MS = 500;

const getInitialSettings = () => {
  const saved = loadSettings();
  return saved ? { ...DEFAULT_SETTINGS, ...saved } : DEFAULT_SETTINGS;
};

export function useSettings() {
  const [settings, setSettings] = useState(getInitialSettings);
  const saveTimeoutRef = useRef(null);
  const settingsRef = useRef(settings);

  // Keep settingsRef in sync
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Debounced save settings when changed
  useEffect(() => {
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Schedule new save
    saveTimeoutRef.current = setTimeout(() => {
      saveSettings(settings);
    }, SAVE_DEBOUNCE_MS);

    // Cleanup on unmount or settings change
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [settings]);

  // Save immediately on unmount to prevent data loss
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveSettings(settingsRef.current);
      }
    };
  }, []);

  // Apply theme
  useEffect(() => {
    document.body.className = settings.theme === 'light' ? 'light-theme' : '';
  }, [settings.theme]);

  // Individual setters for convenience
  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateSettings = useCallback((newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // Memoized individual values for components that need specific settings
  const settingsValues = useMemo(() => ({
    theme: settings.theme,
    alertSound: settings.alertSound,
    alertVolume: settings.alertVolume,
    dailyGoal: settings.dailyGoal,
    breakInterval: settings.breakInterval,
    sensitivity: settings.sensitivity,
    alertDelay: settings.alertDelay,
    alertEnabled: settings.alertEnabled,
  }), [settings]);

  return {
    settings: settingsValues,
    updateSetting,
    updateSettings,
    // Individual setters
    setTheme: useCallback((v) => updateSetting('theme', v), [updateSetting]),
    setAlertSound: useCallback((v) => updateSetting('alertSound', v), [updateSetting]),
    setAlertVolume: useCallback((v) => updateSetting('alertVolume', v), [updateSetting]),
    setDailyGoal: useCallback((v) => updateSetting('dailyGoal', v), [updateSetting]),
    setBreakInterval: useCallback((v) => updateSetting('breakInterval', v), [updateSetting]),
    setSensitivity: useCallback((v) => updateSetting('sensitivity', v), [updateSetting]),
    setAlertDelay: useCallback((v) => updateSetting('alertDelay', v), [updateSetting]),
    setAlertEnabled: useCallback((v) => updateSetting('alertEnabled', v), [updateSetting]),
  };
}

export default useSettings;
