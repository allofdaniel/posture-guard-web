import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSettings } from './useSettings';

// Mock storage utilities
vi.mock('../utils/storage', () => ({
  loadSettings: vi.fn(() => null),
  saveSettings: vi.fn(),
}));

describe('useSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.className = '';
  });

  it('should initialize with default settings', () => {
    const { result } = renderHook(() => useSettings());

    expect(result.current.settings.theme).toBe('dark');
    expect(result.current.settings.sensitivity).toBe(1.0);
    expect(result.current.settings.alertEnabled).toBe(true);
    expect(result.current.settings.alertDelay).toBe(3);
    expect(result.current.settings.breakInterval).toBe(30);
    expect(result.current.settings.dailyGoal).toBe(80);
    expect(result.current.settings.alertVolume).toBe(0.5);
    expect(result.current.settings.alertSound).toBe('beep');
  });

  it('should update individual setting', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setSensitivity(1.5);
    });

    expect(result.current.settings.sensitivity).toBe(1.5);
  });

  it('should update multiple settings at once', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateSettings({
        theme: 'light',
        sensitivity: 0.8,
      });
    });

    expect(result.current.settings.theme).toBe('light');
    expect(result.current.settings.sensitivity).toBe(0.8);
  });

  it('should apply light theme class to body', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setTheme('light');
    });

    expect(document.body.className).toBe('light-theme');
  });

  it('should remove theme class for dark theme', () => {
    document.body.className = 'light-theme';
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setTheme('dark');
    });

    expect(document.body.className).toBe('');
  });

  it('should provide all individual setters', () => {
    const { result } = renderHook(() => useSettings());

    expect(typeof result.current.setTheme).toBe('function');
    expect(typeof result.current.setAlertSound).toBe('function');
    expect(typeof result.current.setAlertVolume).toBe('function');
    expect(typeof result.current.setDailyGoal).toBe('function');
    expect(typeof result.current.setBreakInterval).toBe('function');
    expect(typeof result.current.setSensitivity).toBe('function');
    expect(typeof result.current.setAlertDelay).toBe('function');
    expect(typeof result.current.setAlertEnabled).toBe('function');
  });

  it('should update alert enabled state', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setAlertEnabled(false);
    });

    expect(result.current.settings.alertEnabled).toBe(false);
  });

  it('should update break interval', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setBreakInterval(45);
    });

    expect(result.current.settings.breakInterval).toBe(45);
  });

  it('should update alert delay', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.setAlertDelay(5);
    });

    expect(result.current.settings.alertDelay).toBe(5);
  });
});
