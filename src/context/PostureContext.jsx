/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { loadSettings, saveSettings, loadHistory, saveHistory } from '../utils/storage';
import { playBeep, vibrate, showNotification, requestNotificationPermission } from '../utils/audio';

// Initial state
const initialState = {
  // App state
  appState: 'loading', // 'loading' | 'calibrating' | 'monitoring' | 'result'
  isLoading: true,
  loadingProgress: 'AI 모델 로딩 중...',
  cameraError: null,
  cameraReady: false,

  // Posture state
  calibratedPose: null,
  postureStatus: 'good', // 'good' | 'warning' | 'bad'
  postureIssues: [],
  poseInGuide: false,
  cameraAngle: null,
  debugInfo: null,

  // Settings
  sensitivity: 1.0,
  alertEnabled: true,
  alertDelay: 3,
  theme: 'dark',
  alertSound: 'beep',
  alertVolume: 0.5,
  dailyGoal: 80,
  breakInterval: 30,

  // UI state
  showSettings: false,
  showDebug: false,
  showFullSettings: false,
  showHistory: false,
  showStats: false,
  showBreakReminder: false,

  // Stats
  stats: {
    goodTime: 0,
    badTime: 0,
    alerts: 0,
    issueCount: {},
  },

  // Session
  sessionResult: null,
  sessionHistory: [],
};

// Action types
const ActionTypes = {
  SET_APP_STATE: 'SET_APP_STATE',
  SET_LOADING: 'SET_LOADING',
  SET_CAMERA_ERROR: 'SET_CAMERA_ERROR',
  SET_CAMERA_READY: 'SET_CAMERA_READY',
  SET_CALIBRATED_POSE: 'SET_CALIBRATED_POSE',
  SET_POSTURE_STATUS: 'SET_POSTURE_STATUS',
  SET_POSTURE_ISSUES: 'SET_POSTURE_ISSUES',
  SET_POSE_IN_GUIDE: 'SET_POSE_IN_GUIDE',
  SET_CAMERA_ANGLE: 'SET_CAMERA_ANGLE',
  SET_DEBUG_INFO: 'SET_DEBUG_INFO',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  TOGGLE_UI: 'TOGGLE_UI',
  UPDATE_STATS: 'UPDATE_STATS',
  INCREMENT_ALERT: 'INCREMENT_ALERT',
  SET_SESSION_RESULT: 'SET_SESSION_RESULT',
  SET_SESSION_HISTORY: 'SET_SESSION_HISTORY',
  RESET_SESSION: 'RESET_SESSION',
  HYDRATE_STATE: 'HYDRATE_STATE',
};

// Reducer
function postureReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_APP_STATE:
      return { ...state, appState: action.payload };

    case ActionTypes.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload.isLoading,
        loadingProgress: action.payload.progress ?? state.loadingProgress,
      };

    case ActionTypes.SET_CAMERA_ERROR:
      return { ...state, cameraError: action.payload };

    case ActionTypes.SET_CAMERA_READY:
      return { ...state, cameraReady: action.payload };

    case ActionTypes.SET_CALIBRATED_POSE:
      return { ...state, calibratedPose: action.payload };

    case ActionTypes.SET_POSTURE_STATUS:
      return { ...state, postureStatus: action.payload };

    case ActionTypes.SET_POSTURE_ISSUES:
      return { ...state, postureIssues: action.payload };

    case ActionTypes.SET_POSE_IN_GUIDE:
      return { ...state, poseInGuide: action.payload };

    case ActionTypes.SET_CAMERA_ANGLE:
      return { ...state, cameraAngle: action.payload };

    case ActionTypes.SET_DEBUG_INFO:
      return { ...state, debugInfo: action.payload };

    case ActionTypes.UPDATE_SETTINGS:
      return { ...state, ...action.payload };

    case ActionTypes.TOGGLE_UI:
      return { ...state, [action.payload.key]: action.payload.value };

    case ActionTypes.UPDATE_STATS:
      return { ...state, stats: { ...state.stats, ...action.payload } };

    case ActionTypes.INCREMENT_ALERT:
      return {
        ...state,
        stats: { ...state.stats, alerts: state.stats.alerts + 1 }
      };

    case ActionTypes.SET_SESSION_RESULT:
      return { ...state, sessionResult: action.payload };

    case ActionTypes.SET_SESSION_HISTORY:
      return { ...state, sessionHistory: action.payload };

    case ActionTypes.RESET_SESSION:
      return {
        ...state,
        calibratedPose: null,
        postureStatus: 'good',
        postureIssues: [],
        poseInGuide: false,
        cameraAngle: null,
        debugInfo: null,
        stats: { goodTime: 0, badTime: 0, alerts: 0, issueCount: {} },
      };

    case ActionTypes.HYDRATE_STATE:
      return { ...state, ...action.payload };

    default:
      return state;
  }
}

// Context
const PostureContext = createContext(null);

// Provider
export function PostureProvider({ children }) {
  const [state, dispatch] = useReducer(postureReducer, initialState);

  // Refs for mutable state that shouldn't trigger re-renders
  const lastAlertTime = useRef(0);
  const breakTimerRef = useRef(null);
  const sessionStartTimeRef = useRef(null);

  // Load settings and history on mount
  useEffect(() => {
    const settings = loadSettings();
    const history = loadHistory();

    dispatch({
      type: ActionTypes.HYDRATE_STATE,
      payload: {
        ...settings,
        sessionHistory: history,
      },
    });
  }, []);

  // Save settings when they change
  useEffect(() => {
    saveSettings({
      theme: state.theme,
      alertSound: state.alertSound,
      alertVolume: state.alertVolume,
      dailyGoal: state.dailyGoal,
      breakInterval: state.breakInterval,
      sensitivity: state.sensitivity,
      alertDelay: state.alertDelay,
    });
  }, [state.theme, state.alertSound, state.alertVolume, state.dailyGoal,
      state.breakInterval, state.sensitivity, state.alertDelay]);

  // Apply theme
  useEffect(() => {
    document.body.className = state.theme === 'light' ? 'light-theme' : '';
  }, [state.theme]);

  // Actions
  const actions = {
    setAppState: useCallback((appState) => {
      dispatch({ type: ActionTypes.SET_APP_STATE, payload: appState });
    }, []),

    setLoading: useCallback((isLoading, progress) => {
      dispatch({ type: ActionTypes.SET_LOADING, payload: { isLoading, progress } });
    }, []),

    setCameraError: useCallback((error) => {
      dispatch({ type: ActionTypes.SET_CAMERA_ERROR, payload: error });
    }, []),

    setCameraReady: useCallback((ready) => {
      dispatch({ type: ActionTypes.SET_CAMERA_READY, payload: ready });
    }, []),

    setCalibratedPose: useCallback((pose) => {
      dispatch({ type: ActionTypes.SET_CALIBRATED_POSE, payload: pose });
    }, []),

    setPostureStatus: useCallback((status) => {
      dispatch({ type: ActionTypes.SET_POSTURE_STATUS, payload: status });
    }, []),

    setPostureIssues: useCallback((issues) => {
      dispatch({ type: ActionTypes.SET_POSTURE_ISSUES, payload: issues });
    }, []),

    setPoseInGuide: useCallback((inGuide) => {
      dispatch({ type: ActionTypes.SET_POSE_IN_GUIDE, payload: inGuide });
    }, []),

    setCameraAngle: useCallback((angle) => {
      dispatch({ type: ActionTypes.SET_CAMERA_ANGLE, payload: angle });
    }, []),

    setDebugInfo: useCallback((info) => {
      dispatch({ type: ActionTypes.SET_DEBUG_INFO, payload: info });
    }, []),

    updateSettings: useCallback((settings) => {
      dispatch({ type: ActionTypes.UPDATE_SETTINGS, payload: settings });
    }, []),

    toggleUI: useCallback((key, value) => {
      dispatch({ type: ActionTypes.TOGGLE_UI, payload: { key, value } });
    }, []),

    updateStats: useCallback((stats) => {
      dispatch({ type: ActionTypes.UPDATE_STATS, payload: stats });
    }, []),

    triggerAlert: useCallback(() => {
      const now = Date.now();
      if (now - lastAlertTime.current < 3000) return;

      lastAlertTime.current = now;
      dispatch({ type: ActionTypes.INCREMENT_ALERT });

      if (state.alertEnabled) {
        vibrate();
        playBeep();
        showNotification('자세 교정 알림', {
          body: '자세를 바르게 해주세요!',
        });
      }
    }, [state.alertEnabled]),

    setSessionResult: useCallback((result) => {
      dispatch({ type: ActionTypes.SET_SESSION_RESULT, payload: result });
    }, []),

    saveToHistory: useCallback((result) => {
      const newEntry = {
        id: Date.now(),
        date: new Date().toISOString(),
        ...result,
      };
      const updated = [newEntry, ...state.sessionHistory].slice(0, 30);
      dispatch({ type: ActionTypes.SET_SESSION_HISTORY, payload: updated });
      saveHistory(updated);
    }, [state.sessionHistory]),

    resetSession: useCallback(() => {
      dispatch({ type: ActionTypes.RESET_SESSION });
    }, []),

    startBreakTimer: useCallback(() => {
      if (breakTimerRef.current) clearInterval(breakTimerRef.current);
      if (state.breakInterval > 0) {
        breakTimerRef.current = setInterval(() => {
          dispatch({ type: ActionTypes.TOGGLE_UI, payload: { key: 'showBreakReminder', value: true } });
          playBeep();
        }, state.breakInterval * 60 * 1000);
      }
      sessionStartTimeRef.current = Date.now();
    }, [state.breakInterval]),

    stopBreakTimer: useCallback(() => {
      if (breakTimerRef.current) {
        clearInterval(breakTimerRef.current);
        breakTimerRef.current = null;
      }
    }, []),

    requestNotifications: useCallback(() => {
      requestNotificationPermission();
    }, []),

    getSessionDuration: useCallback(() => {
      return sessionStartTimeRef.current
        ? Math.floor((Date.now() - sessionStartTimeRef.current) / 1000)
        : 0;
    }, []),
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (breakTimerRef.current) {
        clearInterval(breakTimerRef.current);
      }
    };
  }, []);

  return (
    <PostureContext.Provider value={{ state, actions }}>
      {children}
    </PostureContext.Provider>
  );
}

// Hook
export function usePosture() {
  const context = useContext(PostureContext);
  if (!context) {
    throw new Error('usePosture must be used within a PostureProvider');
  }
  return context;
}

export { ActionTypes };
export default PostureContext;
