import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadHistory,
  saveHistory,
  addToHistory,
  clearHistory,
  loadSettings,
  saveSettings,
} from './storage';
import { DEFAULT_SETTINGS } from '../constants';

describe('storage utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('loadHistory', () => {
    it('returns empty array when no history exists', () => {
      expect(loadHistory()).toEqual([]);
    });

    it('returns empty array on parse error', () => {
      localStorage.setItem('postureHistory', 'invalid json');
      expect(loadHistory()).toEqual([]);
    });
  });

  describe('saveHistory', () => {
    it('saves history to localStorage and returns true', () => {
      const history = [{ id: 1, goodPercentage: 80 }];
      expect(saveHistory(history)).toBe(true);
    });
  });

  describe('addToHistory', () => {
    it('adds new entry to history', () => {
      const result = { goodPercentage: 90 };
      const updated = addToHistory(result, []);
      expect(updated).toHaveLength(1);
      expect(updated[0].goodPercentage).toBe(90);
      expect(updated[0].id).toBeDefined();
      expect(updated[0].date).toBeDefined();
    });

    it('limits history to 30 entries', () => {
      const existing = Array.from({ length: 35 }, (_, i) => ({ id: i }));
      const result = { goodPercentage: 100 };
      const updated = addToHistory(result, existing);
      expect(updated).toHaveLength(30);
    });

    it('adds new entry at the beginning', () => {
      const existing = [{ id: 1, goodPercentage: 50 }];
      const result = { goodPercentage: 100 };
      const updated = addToHistory(result, existing);
      expect(updated[0].goodPercentage).toBe(100);
    });
  });

  describe('clearHistory', () => {
    it('clears history from localStorage', () => {
      localStorage.setItem('postureHistory', '[]');
      expect(clearHistory()).toBe(true);
      expect(localStorage.getItem('postureHistory')).toBeNull();
    });
  });

  describe('loadSettings', () => {
    it('returns null when no settings exist', () => {
      expect(loadSettings()).toBeNull();
    });
  });

  describe('saveSettings', () => {
    it('saves settings to localStorage and returns true', () => {
      const settings = { theme: 'light' };
      expect(saveSettings(settings)).toBe(true);
    });
  });

  describe('DEFAULT_SETTINGS', () => {
    it('has required default values', () => {
      expect(DEFAULT_SETTINGS.theme).toBe('dark');
      expect(DEFAULT_SETTINGS.alertSound).toBe('beep');
      expect(DEFAULT_SETTINGS.alertVolume).toBe(0.5);
      expect(DEFAULT_SETTINGS.dailyGoal).toBe(80);
      expect(DEFAULT_SETTINGS.breakInterval).toBe(30);
      expect(DEFAULT_SETTINGS.sensitivity).toBe(1.0);
      expect(DEFAULT_SETTINGS.alertDelay).toBe(3);
      expect(DEFAULT_SETTINGS.alertEnabled).toBe(true);
    });
  });

  describe('saveHistory integration', () => {
    it('saveHistory works correctly', () => {
      const history = [{ id: 1, goodPercentage: 80 }];
      const result = saveHistory(history);
      expect(result).toBe(true);
    });
  });

  describe('addToHistory behavior', () => {
    it('creates entry with timestamp', () => {
      const result = { goodPercentage: 80, duration: 100 };
      const updated = addToHistory(result, []);
      expect(updated[0]).toMatchObject({
        goodPercentage: 80,
        duration: 100,
      });
      expect(typeof updated[0].id).toBe('number');
      expect(typeof updated[0].date).toBe('string');
    });

    it('prepends new entries', () => {
      const existing = [{ id: 1 }, { id: 2 }];
      const result = { goodPercentage: 100 };
      const updated = addToHistory(result, existing);
      expect(updated[0].goodPercentage).toBe(100);
      expect(updated).toHaveLength(3);
    });
  });
});
