import { useState, useRef, useCallback, useEffect } from 'react';
import { loadHistory, saveHistory } from '../utils';
import { MAX_HISTORY_ENTRIES, ALERT_COOLDOWN_MS } from '../constants';

/**
 * Hook for managing posture monitoring sessions
 * @returns {Object} Session state and controls
 */
export function useSessionManager() {
  const sessionStartTimeRef = useRef(null);
  const breakTimerRef = useRef(null);
  const lastAlertTimeRef = useRef(0);
  const statsRef = useRef({
    goodTime: 0,
    badTime: 0,
    alerts: 0,
    issueCount: {},
  });

  const [stats, setStats] = useState({ goodTime: 0, badTime: 0, alerts: 0, issueCount: {} });
  const [sessionResult, setSessionResult] = useState(null);
  const [sessionHistory, setSessionHistory] = useState(() => loadHistory());

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  // Update stats based on posture status
  const updateStats = useCallback(({ status, persistentNewIssues = [] }) => {
    setStats(prev => {
      const updatedIssueCount = { ...prev.issueCount };
      persistentNewIssues.forEach(issue => {
        updatedIssueCount[issue] = (updatedIssueCount[issue] || 0) + 1;
      });
      return {
        ...prev,
        goodTime: status === 'good' ? prev.goodTime + 1 : prev.goodTime,
        badTime: status !== 'good' ? prev.badTime + 1 : prev.badTime,
        issueCount: updatedIssueCount,
      };
    });
  }, []);

  // Increment alert count with cooldown
  const incrementAlerts = useCallback(() => {
    const now = Date.now();
    if (now - lastAlertTimeRef.current < ALERT_COOLDOWN_MS) return false;

    lastAlertTimeRef.current = now;
    setStats(prev => ({ ...prev, alerts: prev.alerts + 1 }));
    return true;
  }, []);

  // Start a new session
  const startSession = useCallback((breakInterval, onBreakReminder) => {
    sessionStartTimeRef.current = Date.now();
    statsRef.current = {
      goodTime: 0,
      badTime: 0,
      alerts: 0,
      issueCount: {},
    };
    setStats({ goodTime: 0, badTime: 0, alerts: 0, issueCount: {} });
    setSessionResult(null);

    // Set up break reminder timer
    if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    if (breakInterval > 0 && onBreakReminder) {
      breakTimerRef.current = setInterval(() => {
        onBreakReminder();
      }, breakInterval * 60 * 1000);
    }
  }, []);

  // End current session and save result
  const endSession = useCallback((calibratedPose, timeline = []) => {
    // Clear break timer
    if (breakTimerRef.current) {
      clearInterval(breakTimerRef.current);
      breakTimerRef.current = null;
    }

    const currentStats = statsRef.current;
    const sessionDuration = sessionStartTimeRef.current
      ? Math.floor((Date.now() - sessionStartTimeRef.current) / 1000)
      : 0;
    const totalTicks = currentStats.goodTime + currentStats.badTime;
    const goodPercentage = totalTicks > 0 ? Math.round((currentStats.goodTime / totalTicks) * 100) : 0;

    const result = {
      duration: sessionDuration,
      goodTime: currentStats.goodTime,
      badTime: currentStats.badTime,
      alerts: currentStats.alerts,
      goodPercentage,
      issueCount: { ...currentStats.issueCount },
      viewMode: calibratedPose?.viewMode || 'front',
      timestamp: new Date().toISOString(),
      startTime: sessionStartTimeRef.current ? new Date(sessionStartTimeRef.current).toISOString() : null,
      timeline,
    };

    setSessionResult(result);

    const saved = { id: Date.now(), date: new Date().toISOString(), ...result };
    setSessionHistory((prevHistory) => {
      const updated = [saved, ...prevHistory].slice(0, MAX_HISTORY_ENTRIES);
      saveHistory(updated);
      return updated;
    });

    // Reset session start time
    sessionStartTimeRef.current = null;

    return saved;
  }, []);

  // Reset stats for recalibration (without saving)
  const resetStats = useCallback(() => {
    setStats({ goodTime: 0, badTime: 0, alerts: 0, issueCount: {} });
  }, []);

  // Clear session result
  const clearSessionResult = useCallback(() => {
    setSessionResult(null);
  }, []);

  // Clear all history
  const clearHistory = useCallback(() => {
    setSessionHistory([]);
    saveHistory([]);
  }, []);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (breakTimerRef.current) {
      clearInterval(breakTimerRef.current);
      breakTimerRef.current = null;
    }
  }, []);

  return {
    stats,
    sessionResult,
    sessionHistory,
    updateStats,
    incrementAlerts,
    startSession,
    endSession,
    resetStats,
    clearSessionResult,
    clearHistory,
    cleanup,
  };
}

export default useSessionManager;
