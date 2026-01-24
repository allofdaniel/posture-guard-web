import { useState, useEffect, useCallback, useMemo } from 'react';
import { loadSettings, saveSettings } from '../utils/storage';

const DEFAULT_SETTINGS = {
  theme: 'dark',
  alertSound: 'beep',
  alertVolume: 0.5,
  dailyGoal: 80,
  breakInterval: 30,
  sensitivity: 1.0,
  alertDelay: 3,
  alertEnabled: true,
};

const getInitialSettings = () => {
  const saved = loadSettings();
  return saved ? { ...DEFAULT_SETTINGS, ...saved } : DEFAULT_SETTINGS;
};

export function useSettings() {
  const [settings, setSettings] = useState(getInitialSettings);

  // Save settings when changed
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

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
